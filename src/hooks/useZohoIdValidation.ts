import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zohoClient } from '@/lib/zohoClient';
import { toast } from 'sonner';

const FIELDS: Array<{ column: 'zoho_estimate_id' | 'zoho_sales_order_id' | 'zoho_deal_id'; module: string; label: string }> = [
  { column: 'zoho_estimate_id', module: 'Quotes', label: 'Angebot' },
  { column: 'zoho_sales_order_id', module: 'Sales_Orders', label: 'Auftrag' },
  { column: 'zoho_deal_id', module: 'Deals', label: 'Potential' },
];

const checkedThisSession = new Set<string>();

/**
 * Verify that the Zoho IDs stored on the project still resolve in Zoho CRM.
 *
 * Only the three FK columns (zoho_deal_id, zoho_estimate_id,
 * zoho_sales_order_id) are touched. All other project data — Kalkulation,
 * Zusatzvereinbarungen, Kundendaten, Auftrags-Bestätigung, Dokumente — is
 * the source of truth in this app and is never modified by this hook.
 *
 * If a referenced Zoho record was deleted (e.g. user trashed the Quote in
 * Zoho CRM), only the link is severed, so the UI offers a fresh
 * "Angebot in Zoho erstellen" instead of trying to update a tombstone.
 *
 * Runs once per (projectId, session). Network / auth errors leave the IDs
 * untouched (we never clear on uncertainty).
 */
export function useZohoIdValidation(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || ranFor.current === projectId) return;
    ranFor.current = projectId;

    const cacheKey = `zoho-validation:${projectId}`;
    if (checkedThisSession.has(cacheKey)) return;
    checkedThisSession.add(cacheKey);

    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('projects')
        .select('zoho_deal_id, zoho_estimate_id, zoho_sales_order_id')
        .eq('id', projectId)
        .maybeSingle();
      if (!row || cancelled) return;

      const updates: Record<string, null> = {};
      const cleared: string[] = [];

      for (const { column, module, label } of FIELDS) {
        const id = (row as any)[column];
        if (!id) continue;
        const exists = await zohoClient.recordExists(module, id);
        // null = network/auth issue -> don't touch the field this session
        if (exists === false) {
          updates[column] = null;
          cleared.push(label);
        }
      }

      if (Object.keys(updates).length === 0 || cancelled) return;

      const { error } = await supabase.from('projects').update(updates).eq('id', projectId);
      if (error) {
        console.warn('[useZohoIdValidation] failed to clear stale IDs', error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project_zoho_ids', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.info(
        `${cleared.join(' / ')} in Zoho nicht mehr vorhanden – Verknüpfung gelöst. Alle lokalen Daten bleiben erhalten; ein neuer Zoho-Datensatz kann jetzt angelegt werden.`,
        { duration: 6000 },
      );
    })().catch(e => console.warn('[useZohoIdValidation] error', e));

    return () => { cancelled = true; };
  }, [projectId, queryClient]);
}
