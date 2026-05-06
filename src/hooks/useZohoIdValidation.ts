import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zohoClient, isZohoIdFresh } from '@/lib/zohoClient';
import { toast } from 'sonner';

const FIELDS: Array<{ column: 'zoho_estimate_id' | 'zoho_sales_order_id' | 'zoho_deal_id'; module: string; label: string }> = [
  { column: 'zoho_estimate_id', module: 'Quotes', label: 'Angebot' },
  { column: 'zoho_sales_order_id', module: 'Sales_Orders', label: 'Auftrag' },
  { column: 'zoho_deal_id', module: 'Deals', label: 'Potential' },
];

// Throttle so a quick tab-blur/focus storm doesn't trigger N parallel runs.
const MIN_INTERVAL_MS = 5_000;

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
 * Runs:
 *   - on mount,
 *   - on window focus / tab visibility change (covers "delete in Zoho tab,
 *     switch back to app tab" without a full reload),
 *   - throttled to one run per 5s per project.
 *
 * Network / auth errors leave the IDs untouched (we never clear on uncertainty).
 */
export function useZohoIdValidation(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const lastRunAt = useRef(0);

  const validate = useCallback(async () => {
    if (!projectId) return;
    if (inFlight.current) return;
    if (Date.now() - lastRunAt.current < MIN_INTERVAL_MS) return;
    inFlight.current = true;
    lastRunAt.current = Date.now();

    try {
      const { data: row } = await supabase
        .from('projects')
        .select('zoho_deal_id, zoho_estimate_id, zoho_sales_order_id')
        .eq('id', projectId)
        .maybeSingle();
      if (!row) return;

      const updates: Record<string, null> = {};
      const cleared: string[] = [];

      for (const { column, module, label } of FIELDS) {
        const id = (row as any)[column];
        if (!id) continue;
        // Skip just-created/updated IDs: Zoho's read pipeline can briefly
        // 404/empty a brand-new record. Without this the validation hook
        // would dissolve the link the user just created.
        if (isZohoIdFresh(id)) {
          console.log('[zoho-validation] skip fresh', module, id);
          continue;
        }
        const exists = await zohoClient.recordExists(module, id);
        console.log('[zoho-validation]', module, id, 'exists=', exists);
        // null = network/auth issue -> don't touch the field this run
        if (exists === false) {
          updates[column] = null;
          cleared.push(label);
        }
      }

      if (Object.keys(updates).length === 0) return;

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
    } catch (e) {
      console.warn('[useZohoIdValidation] error', e);
    } finally {
      inFlight.current = false;
    }
  }, [projectId, queryClient]);

  useEffect(() => {
    if (!projectId) return;
    // Reset throttle when switching projects so the new one validates immediately.
    lastRunAt.current = 0;
    validate();

    const onFocus = () => { void validate(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void validate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [projectId, validate]);
}
