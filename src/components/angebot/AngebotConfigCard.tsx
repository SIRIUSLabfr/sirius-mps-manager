import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { Zusatzvereinbarungen } from './ZusatzvereinbarungenCard';
import AngebotPreviewDialog from './AngebotPreviewDialog';

interface CalcData {
  finance_type: string;
  term_months: number;
  total_monthly_rate: number;
  total_hardware_ek: number;
  service_rate: number;
  config_json: any;
  leasing_factor?: number;
  margin_total?: number;
}

interface Props {
  projectId: string;
  projectName: string;
  calcData: CalcData | null;
  zusatz: Zusatzvereinbarungen;
  customerName?: string;
  contactPerson?: string;
  customerAddress?: string;
  customerNumber?: string;
  angebotNumber?: string;
  ansprechpartner?: { name: string; role?: string; email?: string; phone?: string } | null;
  customerLogoUrl?: string;
}

const financeLabels: Record<string, string> = {
  leasing: 'Leasing (Bank)',
  eigenmiete: 'Eigenmiete (SIRIUS)',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  allin: 'All-In-Vertrag',
};

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AngebotConfigCard({
  projectId,
  projectName,
  calcData,
  zusatz,
  customerName,
  contactPerson,
  customerAddress,
  customerNumber,
  angebotNumber,
  ansprechpartner,
  customerLogoUrl,
}: Props) {
  const [showPrices, setShowPrices] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const queryClient = useQueryClient();

  const groups = calcData?.config_json?.device_groups || calcData?.config_json?.deviceGroups || [];
  const deviceCount = groups.reduce((sum: number, g: any) => sum + (g.mainQuantity || 0), 0) || 0;
  const calc = calcData?.config_json?.calculated || {};
  const folgeseitenSw = calc.folgeseitenpreis_sw || calcData?.config_json?.folgeseitenpreis_sw || 0;
  const folgeseitenFarbe = calc.folgeseitenpreis_farbe || calcData?.config_json?.folgeseitenpreis_farbe || 0;
  const swVolume = calc.total_volume_bw || calc.totalSwVolume || 0;
  const colorVolume = calc.total_volume_color || calc.totalColorVolume || 0;

  const { data: projectRow } = useQuery({
    queryKey: ['project_zoho_ids', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('zoho_deal_id, zoho_estimate_id, zoho_sales_order_id')
        .eq('id', projectId)
        .maybeSingle();
      return data;
    },
  });

  const existingQuoteId = projectRow?.zoho_estimate_id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📄 Angebot</CardTitle>
      </CardHeader>
      <CardContent>
        {!calcData ? (
          <p className="text-sm text-muted-foreground">
            Bitte zuerst eine Kalkulation im Kalkulations-Modul anlegen.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Vertragsart</p>
                <p className="font-medium text-sm">
                  {financeLabels[calcData.finance_type] || calcData.finance_type}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Laufzeit</p>
                <p className="font-medium text-sm">{calcData.term_months} Monate</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Geräteanzahl</p>
                <p className="font-medium text-sm">{deviceCount} Geräte</p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Monatliche Rate</p>
              <p className="text-2xl font-heading font-bold text-primary">
                {fmt(calcData.total_monthly_rate || 0)} €
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">S/W-Volumen: </span>
                <span className="font-medium">{swVolume.toLocaleString('de-DE')} Seiten/Monat</span>
              </div>
              <div>
                <span className="text-muted-foreground">Farb-Volumen: </span>
                <span className="font-medium">
                  {colorVolume.toLocaleString('de-DE')} Seiten/Monat
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis S/W: </span>
                <span className="font-medium">
                  {folgeseitenSw.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis Farbe: </span>
                <span className="font-medium">
                  {folgeseitenFarbe.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg px-3 py-2">
              <Label className="text-sm">Einzelpreise in Vorschau anzeigen</Label>
              <Switch checked={showPrices} onCheckedChange={setShowPrices} />
            </div>

            <Button onClick={() => setPreviewOpen(true)} className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              PDF Vorschau & in Zoho speichern
            </Button>

            {existingQuoteId && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Verknüpft mit Zoho-Angebot <strong>#{existingQuoteId}</strong>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (
                      !confirm(
                        'Verknüpfung zum Zoho-Angebot wirklich entfernen?\n\nLokale Daten (Kalkulation, Zusatzvereinbarungen, Dokumente) bleiben unverändert. Ein neues Zoho-Angebot wird erst beim nächsten Speichern aus der Vorschau angelegt.',
                      )
                    )
                      return;
                    const { error } = await supabase
                      .from('projects')
                      .update({ zoho_estimate_id: null })
                      .eq('id', projectId);
                    if (error) {
                      toast.error('Fehler: ' + error.message);
                      return;
                    }
                    queryClient.invalidateQueries({ queryKey: ['project_zoho_ids', projectId] });
                    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                    toast.success('Verknüpfung entfernt.');
                  }}
                >
                  Verknüpfung entfernen
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {calcData && (
        <AngebotPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          projectId={projectId}
          projectName={projectName}
          customerName={customerName}
          customerNumber={customerNumber}
          customerAddress={customerAddress}
          contactPerson={contactPerson}
          angebotNumber={angebotNumber}
          ansprechpartner={ansprechpartner}
          customerLogoUrl={customerLogoUrl}
          calcData={calcData}
          zusatz={zusatz}
          quoteId={existingQuoteId}
        />
      )}
    </Card>
  );
}
