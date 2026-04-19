import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Zusatzvereinbarungen } from './ZusatzvereinbarungenCard';
import { buildQuotePayload } from '@/lib/zohoQuoteBuilder';
import { zohoClient, QUOTE_INVENTORY_TEMPLATE_ID } from '@/lib/zohoClient';
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
}

const financeLabels: Record<string, string> = {
  leasing: 'Leasing (Bank)',
  eigenmiete: 'Eigenmiete (SIRIUS)',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  allin: 'All-In-Vertrag',
};

const fmt = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AngebotConfigCard({ projectId, projectName, calcData, zusatz, customerName, contactPerson, customerAddress, customerNumber, angebotNumber, ansprechpartner }: Props) {
  const [zohoBusy, setZohoBusy] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const queryClient = useQueryClient();

  const groups = calcData?.config_json?.device_groups || calcData?.config_json?.deviceGroups || [];
  const deviceCount = groups.reduce((sum: number, g: any) => sum + (g.mainQuantity || 0), 0) || 0;
  const calc = calcData?.config_json?.calculated || {};
  const folgeseitenSw = calc.folgeseitenpreis_sw || calcData?.config_json?.folgeseitenpreis_sw || 0;
  const folgeseitenFarbe = calc.folgeseitenpreis_farbe || calcData?.config_json?.folgeseitenpreis_farbe || 0;
  const swVolume = calc.total_volume_bw || calc.totalSwVolume || 0;
  const colorVolume = calc.total_volume_color || calc.totalColorVolume || 0;

  // Project context
  const { data: projectRow } = useQuery({
    queryKey: ['project_zoho_ids', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('projects')
        .select('zoho_deal_id, zoho_estimate_id, zoho_sales_order_id')
        .eq('id', projectId)
        .maybeSingle();
      return data;
    },
  });

  const existingQuoteId = projectRow?.zoho_estimate_id;

  /** Create or update Zoho Quote, generate template PDF, attach + store. */
  const runZohoQuoteFlow = async (mode: 'create' | 'update') => {
    if (!calcData) {
      toast.error('Bitte zuerst eine Kalkulation erstellen.');
      return;
    }
    setZohoBusy(true);
    try {
      // Fetch deal data for contact/account refs
      const dealId = projectRow?.zoho_deal_id || undefined;
      let contactId: string | undefined;
      let accountId: string | undefined;
      if (dealId) {
        const dealRes = await zohoClient.getDeal(dealId);
        const deal = dealRes?.data?.[0];
        contactId = deal?.Contact_Name?.id;
        accountId = deal?.Account_Name?.id;
      }

      const payload = buildQuotePayload({
        projectName: projectName,
        customerName,
        dealId,
        contactZohoId: contactId,
        accountZohoId: accountId,
        calcData,
        zusatz,
        validity: 30,
      });

      // 1. Create or update quote
      let quoteId: string;
      if (mode === 'update' && existingQuoteId) {
        const upd = await zohoClient.updateQuote(existingQuoteId, payload);
        const updResp = upd?.data?.[0];
        if (updResp?.code && updResp.code !== 'SUCCESS') {
          throw new Error(updResp?.message || 'Quote-Update fehlgeschlagen');
        }
        quoteId = existingQuoteId;
      } else {
        const created = await zohoClient.createQuote(payload);
        const createdResp = created?.data?.[0];
        if (createdResp?.code !== 'SUCCESS') {
          throw new Error(createdResp?.message || 'Quote-Erstellung fehlgeschlagen');
        }
        quoteId = createdResp.details.id;
        await supabase.from('projects').update({ zoho_estimate_id: quoteId }).eq('id', projectId);
      }

      // 2. Generate PDF via Zoho Inventory Template
      toast.message('Generiere PDF aus Zoho-Vorlage...');
      const pdfBlob = await zohoClient.getQuotePdf(quoteId, QUOTE_INVENTORY_TEMPLATE_ID);
      if (!pdfBlob) throw new Error('PDF konnte nicht aus Zoho geladen werden.');

      const fileName = `Angebot_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // 3. Upload to Supabase storage
      const filePath = `${projectId}/angebote/zoho_${Date.now()}_${fileName}`;
      const { error: upErr } = await supabase.storage
        .from('project-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('project-documents').getPublicUrl(filePath);

      // 4. Attach PDF back to Zoho Quote
      const attachRes = await zohoClient.attachToQuote(quoteId, pdfBlob, fileName);
      const zohoAttachmentId = attachRes?.data?.[0]?.details?.id;

      // 5. Save document record
      await supabase.from('documents').insert({
        project_id: projectId,
        document_type: 'angebot',
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: pdfBlob.size,
        zoho_attachment_id: zohoAttachmentId || null,
      });

      // 6. Refresh queries
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project_zoho_ids', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      // 7. Open PDF for user
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');

      toast.success(mode === 'update' ? 'Angebot in Zoho aktualisiert.' : 'Angebot in Zoho erstellt.');
    } catch (err: any) {
      console.error(err);
      toast.error('Zoho-Fehler: ' + (err.message || err));
    } finally {
      setZohoBusy(false);
    }
  };

  const handleZohoClick = () => {
    if (existingQuoteId) {
      setConfirmReplace(true);
    } else {
      runZohoQuoteFlow('create');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📄 Angebot erstellen</CardTitle>
      </CardHeader>
      <CardContent>
        {!calcData ? (
          <p className="text-sm text-muted-foreground">Bitte zuerst eine Kalkulation im Kalkulations-Modul anlegen.</p>
        ) : (
          <div className="space-y-4">
            {/* Read-only preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Vertragsart</p>
                <p className="font-medium text-sm">{financeLabels[calcData.finance_type] || calcData.finance_type}</p>
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

            {/* Prominent monthly rate */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Monatliche Rate</p>
              <p className="text-2xl font-heading font-bold text-primary">{fmt(calcData.total_monthly_rate || 0)} €</p>
            </div>

            {/* Volume info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">S/W-Volumen: </span>
                <span className="font-medium">{swVolume.toLocaleString('de-DE')} Seiten/Monat</span>
              </div>
              <div>
                <span className="text-muted-foreground">Farb-Volumen: </span>
                <span className="font-medium">{colorVolume.toLocaleString('de-DE')} Seiten/Monat</span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis S/W: </span>
                <span className="font-medium">{folgeseitenSw.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €</span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis Farbe: </span>
                <span className="font-medium">{folgeseitenFarbe.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €</span>
              </div>
            </div>

            {/* PDF Options */}
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PDF-Optionen (lokales PDF)</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Einzelpreise anzeigen</Label>
                <Switch checked={showPrices} onCheckedChange={setShowPrices} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => setPreviewOpen(true)} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                PDF Vorschau
              </Button>
              <Button onClick={handleZohoClick} disabled={zohoBusy}>
                {zohoBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {existingQuoteId ? 'Zoho-Angebot aktualisieren' : 'Angebot in Zoho erstellen'}
              </Button>
            </div>

            {existingQuoteId && (
              <p className="text-xs text-muted-foreground text-center">
                Bestehendes Zoho-Angebot: <strong>#{existingQuoteId}</strong>
              </p>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestehendes Angebot vorhanden</AlertDialogTitle>
            <AlertDialogDescription>
              Es existiert bereits ein Zoho-Angebot (#{existingQuoteId}). Möchtest du das bestehende
              Angebot updaten oder ein neues als Revision anlegen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReplace(false); runZohoQuoteFlow('create'); }}>
              Neue Revision
            </AlertDialogAction>
            <AlertDialogAction onClick={() => { setConfirmReplace(false); runZohoQuoteFlow('update'); }}>
              Updaten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
