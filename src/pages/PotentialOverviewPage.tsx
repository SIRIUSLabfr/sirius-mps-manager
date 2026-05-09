import { useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { zohoClient, markZohoIdFresh } from '@/lib/zohoClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Building2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useZohoIdValidation } from '@/hooks/useZohoIdValidation';
import ContactPicker, { type ContactEntry } from '@/components/potential/ContactPicker';
import CustomerLogoCard from '@/components/potential/CustomerLogoCard';

export default function PotentialOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: devices } = useProjectDevices(projectId || null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  // Drop stale Quote/Sales-Order/Deal IDs if the records were deleted in Zoho.
  useZohoIdValidation(projectId || null);

  const dealId = (project as any)?.zoho_deal_id;
  const orderConfirmedAt = (project as any)?.order_confirmed_at;
  const estimateId = (project as any)?.zoho_estimate_id;
  const salesOrderId = (project as any)?.zoho_sales_order_id;

  // Live Zoho deal
  const { data: deal } = useQuery({
    queryKey: ['zoho_deal', dealId],
    queryFn: async () => (dealId ? await zohoClient.getDeal(dealId) : null),
    enabled: !!dealId,
  });
  const dealRecord = deal?.data?.[0] || null;

  // Calculation (für quote_config / Geräte-Übernahme)
  const { data: calc } = useQuery({
    queryKey: ['calculation_active', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await supabase
        .from('calculations')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // Geräte aus Kalkulation extrahieren (für Anzeige vor Auftrag)
  const calcDevices = useMemo(() => {
    const cfg: any = calc?.config_json;
    if (!cfg?.deviceGroups) return [];
    const list: Array<{ key: string; manufacturer: string; model: string; quantity: number; options?: string }> = [];
    cfg.deviceGroups.forEach((g: any, idx: number) => {
      list.push({
        key: g.id || `g-${idx}`,
        manufacturer: g.manufacturer || g.brand || '',
        model: g.model || g.name || '',
        quantity: g.quantity || g.qty || 1,
        options: g.options || g.accessories || '',
      });
    });
    return list;
  }, [calc]);

  const orderedDevices = useMemo(() => devices?.filter(d => d.from_quote_item_id) || [], [devices]);

  const [orderLoading, setOrderLoading] = useState(false);
  const handleOrderConfirmed = async () => {
    if (!projectId) return;
    if (!confirm('Auftrag erteilt? Damit werden die Geräte aus der Kalkulation übernommen und (in Kürze) das Angebot in Zoho zum Auftrag konvertiert.')) return;
    setOrderLoading(true);
    try {
      // 1. Geräte aus quote_config in devices anlegen (sofern noch nicht da)
      const inserts = calcDevices.flatMap(g => {
        return Array.from({ length: g.quantity || 1 }).map((_, i) => ({
          project_id: projectId,
          soll_manufacturer: g.manufacturer,
          soll_model: g.model,
          soll_options: g.options || null,
          from_quote_item_id: `${g.key}-${i + 1}`,
          preparation_status: 'pending' as const,
        }));
      });

      // Existierende from_quote_item_ids überspringen
      const existingKeys = new Set((devices || []).map(d => d.from_quote_item_id).filter(Boolean));
      const toInsert = inserts.filter(d => !existingKeys.has(d.from_quote_item_id));

      if (toInsert.length > 0) {
        const { error: devErr } = await supabase.from('devices').insert(toInsert);
        if (devErr) throw devErr;
      }

      // 2. Zoho Quote → Sales Order konvertieren (sofern Quote vorhanden)
      let newSalesOrderId: string | null = null;
      if (estimateId && !salesOrderId) {
        try {
          const conv = await zohoClient.convertQuoteToSalesOrder(estimateId);
          newSalesOrderId = zohoClient.extractSalesOrderId(conv);
          markZohoIdFresh(newSalesOrderId);
          if (newSalesOrderId) {
            toast.success(`Auftrag in Zoho angelegt: #${newSalesOrderId}`);
          }
        } catch (convErr: any) {
          console.warn('Zoho-Convert fehlgeschlagen:', convErr);
          toast.warning('Auftrag lokal erteilt – Zoho-Convert fehlgeschlagen: ' + (convErr.message || convErr));
        }
      }

      // 3. Projekt-Status updaten
      const { error: projErr } = await supabase
        .from('projects')
        .update({
          order_confirmed_at: new Date().toISOString(),
          status: 'in_progress',
          ...(newSalesOrderId ? { zoho_sales_order_id: newSalesOrderId } : {}),
        })
        .eq('id', projectId);
      if (projErr) throw projErr;

      toast.success(`${toInsert.length} Gerät(e) übernommen. Auftrag erteilt.`);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
    } catch (e: any) {
      toast.error('Fehler: ' + (e.message || e));
    } finally {
      setOrderLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-6 text-center text-muted-foreground">Auftrag nicht gefunden.</div>;
  }

  const formatEur = (v?: number | string | null) => {
    if (v === null || v === undefined || v === '') return '–';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return '–';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  };

  const stage = dealRecord?.Stage;
  const amount = dealRecord?.Amount;
  const closingDate = dealRecord?.Closing_Date;
  const owner = dealRecord?.Owner?.name;
  const accountName = dealRecord?.Account_Name?.name;
  const accountId = dealRecord?.Account_Name?.id || null;
  const dealName = dealRecord?.Deal_Name;

  const customerContacts: ContactEntry[] = useMemo(() => {
    const raw = (project as any)?.customer_contacts;
    return Array.isArray(raw) ? raw : [];
  }, [project]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold">Potentialübersicht</h1>
            <p className="text-sm text-muted-foreground">{project.customer_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dealId && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://crm.zoho.eu/crm/org/Deals/${dealId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Zoho Potential
              </a>
            </Button>
          )}
          {!orderConfirmedAt ? (
            <Button onClick={handleOrderConfirmed} disabled={orderLoading || calcDevices.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Auftrag erteilt
            </Button>
          ) : (
            <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Auftrag erteilt
            </Badge>
          )}
        </div>
      </div>

      {/* Zoho Deal Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Zoho Potential
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dealId ? (
            <p className="text-sm text-muted-foreground">Keinem Zoho-Potential zugeordnet.</p>
          ) : !dealRecord ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Potential</p>
                <p className="font-medium">{dealName || '–'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Kunde</p>
                <p className="font-medium">{accountName || '–'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Stage</p>
                <Badge variant="outline">{stage || '–'}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Volumen</p>
                <p className="font-medium">{formatEur(amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Closing</p>
                <p className="font-medium">{closingDate || '–'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Owner</p>
                <p className="font-medium">{owner || '–'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Angebot</p>
                <p className="font-medium">{estimateId ? `#${estimateId}` : '–'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Auftrag</p>
                <p className="font-medium">{salesOrderId ? `#${salesOrderId}` : '–'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactPicker
        projectId={projectId!}
        accountId={accountId}
        contacts={customerContacts}
        onChange={() => {
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        }}
      />

      <CustomerLogoCard
        projectId={projectId!}
        logoUrl={(project as any)?.quote_config?.customer_logo_data_uri}
      />

    </div>
  );
}
