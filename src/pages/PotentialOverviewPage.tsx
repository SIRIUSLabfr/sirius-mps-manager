import { useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { zohoClient } from '@/lib/zohoClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Building2, User, Euro, FileText, CheckCircle2, Send, ExternalLink, Package, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PotentialOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: devices } = useProjectDevices(projectId || null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

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

  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const toggleDevice = (id: string) => {
    setSelectedDeviceIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selectedDeviceIds.size === orderedDevices.length) setSelectedDeviceIds(new Set());
    else setSelectedDeviceIds(new Set(orderedDevices.map(d => d.id)));
  };

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
          newSalesOrderId = conv?.data?.[0]?.details?.SalesOrder?.id
            || conv?.data?.[0]?.details?.id
            || null;
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

  const handleSopPush = async () => {
    if (selectedDeviceIds.size === 0) {
      toast.warning('Bitte mindestens ein Gerät auswählen.');
      return;
    }
    if (!projectId) return;

    const selectedDevices = orderedDevices.filter(d => selectedDeviceIds.has(d.id));
    const sopRows = selectedDevices.map(d => ({
      project_id: projectId,
      device_id: d.id,
      manufacturer: d.soll_manufacturer || '',
      model: d.soll_model || '',
      options: d.soll_options || '',
      preparation_status: 'pending',
      delivery_status: 'pending',
    }));

    try {
      const { error: sopErr } = await supabase.from('sop_orders').insert(sopRows);
      if (sopErr) throw sopErr;

      // Mark pushed
      const now = new Date().toISOString();
      const { error: devErr } = await supabase
        .from('devices')
        .update({ pushed_to_sop_at: now })
        .in('id', Array.from(selectedDeviceIds));
      if (devErr) throw devErr;

      toast.success(`${selectedDevices.length} Gerät(e) in SOP gepusht.`);
      setSelectedDeviceIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      queryClient.invalidateQueries({ queryKey: ['sop_orders', projectId] });
    } catch (e: any) {
      toast.error('Fehler beim SOP-Push: ' + (e.message || e));
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
  const dealName = dealRecord?.Deal_Name;

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

      {/* MPS Manager Details aus Zoho Deal */}
      {dealId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              MPS Manager Details
              <span className="text-xs font-normal text-muted-foreground">(aus Zoho-Potential)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dealRecord ? (
              <Skeleton className="h-20 w-full" />
            ) : (() => {
              // Try multiple known API name variants for each MPS field
              const pick = (...keys: string[]) => {
                for (const k of keys) {
                  const v = dealRecord?.[k];
                  if (v !== null && v !== undefined && v !== '') return v;
                }
                return null;
              };
              const fmtNum = (v: any) =>
                v === null || v === undefined || v === '' ? '–'
                  : new Intl.NumberFormat('de-DE').format(Number(v));
              const fmtPrice4 = (v: any) =>
                v === null || v === undefined || v === '' ? '–'
                  : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Number(v)) + ' €';
              const fmtPrice2 = (v: any) =>
                v === null || v === undefined || v === '' ? '–'
                  : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v));
              const fmtDate = (v: any) =>
                !v ? '–' : new Date(v).toLocaleDateString('de-DE');

              const fields = [
                {
                  label: 'Vertragsbeginn',
                  value: fmtDate(pick('Vertragsbeginn', 'MPS_Vertragsbeginn', 'Contract_Start', 'cf_vertragsbeginn')),
                },
                {
                  label: 'S/W-Folgeseitenpreis',
                  value: fmtPrice4(pick('S_W_Folgeseitenpreis', 'SW_Folgeseitenpreis', 'MPS_SW_Folgeseitenpreis', 'Folgeseitenpreis_SW')),
                },
                {
                  label: 'S/W-Seitenmenge',
                  value: fmtNum(pick('S_W_Seitenmenge', 'SW_Seitenmenge', 'MPS_Volumen_SW', 'MPS_SW_Seitenmenge', 'Seitenmenge_SW')),
                },
                {
                  label: 'Farbfolgeseitenpreis',
                  value: fmtPrice4(pick('Farbfolgeseitenpreis', 'MPS_Farb_Folgeseitenpreis', 'Folgeseitenpreis_Farbe')),
                },
                {
                  label: 'Farbseitenmenge',
                  value: fmtNum(pick('Farbseitenmenge', 'MPS_Volumen_Farbe', 'MPS_Farbseitenmenge', 'Seitenmenge_Farbe')),
                },
                {
                  label: 'Summe UHG',
                  value: fmtPrice2(pick('Summe_UHG', 'MPS_Summe_UHG', 'UHG_Summe', 'UHG')),
                },
              ];

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  {fields.map(f => (
                    <div key={f.label} className="flex items-center justify-between border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-medium">{f.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">
            <Package className="h-4 w-4 mr-1.5" />
            Beauftragte Geräte
            {orderedDevices.length > 0 && (
              <Badge variant="secondary" className="ml-2">{orderedDevices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calc-preview">
            <FileText className="h-4 w-4 mr-1.5" />
            Aus Kalkulation
            {calcDevices.length > 0 && (
              <Badge variant="secondary" className="ml-2">{calcDevices.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Beauftragte Geräte */}
        <TabsContent value="devices" className="mt-4">
          {!orderConfirmedAt ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                Noch keine Geräte beauftragt.<br />
                Klicke <strong>Auftrag erteilt</strong> oben rechts, sobald der Auftrag bestätigt ist.
              </CardContent>
            </Card>
          ) : orderedDevices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Keine Geräte gefunden. Wurde die Kalkulation befüllt?
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-heading">
                  {orderedDevices.length} Gerät(e)
                </CardTitle>
                <Button size="sm" onClick={handleSopPush} disabled={selectedDeviceIds.size === 0}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  SOP Push ({selectedDeviceIds.size})
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 w-10">
                        <Checkbox
                          checked={selectedDeviceIds.size === orderedDevices.length && orderedDevices.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="text-left p-2 font-heading text-xs">Hersteller</th>
                      <th className="text-left p-2 font-heading text-xs">Modell</th>
                      <th className="text-left p-2 font-heading text-xs">Optionen</th>
                      <th className="text-left p-2 font-heading text-xs">Status</th>
                      <th className="text-left p-2 font-heading text-xs">SOP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedDevices.map(d => (
                      <tr key={d.id} className={cn('border-b hover:bg-accent/30', selectedDeviceIds.has(d.id) && 'bg-accent/30')}>
                        <td className="p-2">
                          <Checkbox
                            checked={selectedDeviceIds.has(d.id)}
                            onCheckedChange={() => toggleDevice(d.id)}
                          />
                        </td>
                        <td className="p-2">{d.soll_manufacturer || '–'}</td>
                        <td className="p-2 font-medium">{d.soll_model || '–'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{d.soll_options || '–'}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">{d.preparation_status}</Badge>
                        </td>
                        <td className="p-2">
                          {(d as any).pushed_to_sop_at ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              gepusht
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aus Kalkulation */}
        <TabsContent value="calc-preview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Geräte aus Kalkulation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {calcDevices.length === 0 ? (
                <p className="p-6 text-sm text-center text-muted-foreground">Noch keine Kalkulation befüllt.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-heading text-xs">Hersteller</th>
                      <th className="text-left p-2 font-heading text-xs">Modell</th>
                      <th className="text-left p-2 font-heading text-xs">Optionen</th>
                      <th className="text-right p-2 font-heading text-xs">Anzahl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcDevices.map(g => (
                      <tr key={g.key} className="border-b">
                        <td className="p-2">{g.manufacturer || '–'}</td>
                        <td className="p-2 font-medium">{g.model || '–'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{g.options || '–'}</td>
                        <td className="p-2 text-right font-mono">{g.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
