import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Save, Download } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  zohoClient,
  markZohoIdFresh,
  ZOHO_ACCOUNT_CUSTOMER_NUMBER_FIELD,
  ZOHO_QUOTE_OFFER_NUMBER_FIELD,
} from '@/lib/zohoClient';
import { buildQuotePayload, buildDraftQuotePayload } from '@/lib/zohoQuoteBuilder';
import { buildAngebotHtml } from '@/lib/angebotPreviewHtml';
import { generateAngebotPdf } from '@/lib/angebotPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Zusatzvereinbarungen } from './ZusatzvereinbarungenCard';

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  customerName?: string;
  customerNumber?: string;
  customerAddress?: string;
  contactPerson?: string;
  angebotNumber?: string;
  ansprechpartner?: { name: string; role?: string; email?: string; phone?: string } | null;
  calcData: CalcData;
  zusatz: Zusatzvereinbarungen;
  /** existing Zoho Quote ID to render */
  quoteId?: string | null;
}

const timestampForFilename = (d = new Date()) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

export default function AngebotPreviewDialog(props: Props) {
  const { open, onOpenChange, projectId, projectName, calcData, zusatz, quoteId } = props;
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const queryClient = useQueryClient();

  // Quote-Metadaten aus Zoho laden, sobald der Dialog mit verknüpfter
  // Quote geöffnet wird. Liefert die Werte für Angebots-Nr. und (über
  // den Account) die Kundennummer, die ins HTML gerendert werden.
  const { data: quoteMeta } = useQuery({
    queryKey: ['zoho-quote-meta', quoteId],
    enabled: !!open && !!quoteId,
    staleTime: 30_000,
    queryFn: async () => {
      const quoteRes = await zohoClient.getQuote(quoteId!);
      const quote = quoteRes?.data?.[0];
      const accountId = quote?.Account_Name?.id;
      let accountFields: Record<string, any> | null = null;
      if (accountId) {
        const accRes = await zohoClient.getAccount(accountId);
        accountFields = accRes?.data?.[0] || null;
      }
      const customerNumber =
        accountFields?.[ZOHO_ACCOUNT_CUSTOMER_NUMBER_FIELD] ||
        accountFields?.Account_Number ||
        undefined;
      const offerNumber =
        quote?.[ZOHO_QUOTE_OFFER_NUMBER_FIELD] || quote?.Quote_Number || undefined;
      return {
        angebotNumber: offerNumber ? String(offerNumber) : undefined,
        customerNumber: customerNumber ? String(customerNumber) : undefined,
      };
    },
  });

  // Werte aus Zoho schlagen die props (die noch leer sein können, solange
  // die Vorschau das Inventory-Template-Bild widerspiegelt).
  const enrichedProps: Props = {
    ...props,
    angebotNumber: quoteMeta?.angebotNumber || props.angebotNumber,
    customerNumber: quoteMeta?.customerNumber || props.customerNumber,
  };

  const html = open ? buildAngebotHtml(enrichedProps, { forPdf: false }) : '';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfBlob = await generateAngebotPdf({
        projectName,
        projectId,
        calcData,
        zusatz,
        customerName: props.customerName,
        customerNumber: enrichedProps.customerNumber,
        customerAddress: props.customerAddress,
        contactPerson: props.contactPerson,
        angebotNumber: enrichedProps.angebotNumber,
        ansprechpartner: props.ansprechpartner,
      });
      const fileName = `Angebot_${enrichedProps.angebotNumber || 'NEU'}_${timestampForFilename()}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`PDF heruntergeladen: ${fileName}`);
    } catch (err: any) {
      console.error('[AngebotPreviewDialog] download failed:', err);
      toast.error('Fehler beim Erzeugen: ' + (err?.message || err));
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToZoho = async () => {
    setSaving(true);
    try {
      const layoutId = await zohoClient.getQuoteLayoutId();
      if (!layoutId) {
        throw new Error(
          'Zoho-Layout "Standard" nicht gefunden. Bitte in Zoho CRM unter Einstellungen → Layouts ein Layout mit Namen "Standard" für das Modul Angebote anlegen.',
        );
      }

      // Bestandsprojekt ohne Draft-Quote? Eine Quote nachträglich anlegen,
      // sofern wir wenigstens einen Deal haben — sonst hilflos.
      let activeQuoteId = quoteId || null;
      if (!activeQuoteId) {
        const { data: projectRow } = await supabase
          .from('projects')
          .select('zoho_deal_id')
          .eq('id', projectId)
          .maybeSingle();
        if (!projectRow?.zoho_deal_id) {
          throw new Error(
            'Projekt ist mit keinem Zoho-Deal verknüpft. Bitte das Projekt aus Zoho heraus anlegen oder den Deal manuell verknüpfen.',
          );
        }
        const dealRes = await zohoClient.getDeal(projectRow.zoho_deal_id);
        const deal = dealRes?.data?.[0];
        const draftPayload = buildDraftQuotePayload({
          projectName,
          layoutId,
          dealId: projectRow.zoho_deal_id,
          contactZohoId: deal?.Contact_Name?.id,
          accountZohoId: deal?.Account_Name?.id,
          validity: 30,
        });
        const created = await zohoClient.createQuote(draftPayload);
        const cd = created?.data?.[0];
        if (cd?.code !== 'SUCCESS' || !cd.details?.id) {
          throw new Error(cd?.message || 'Quote-Erstellung fehlgeschlagen');
        }
        activeQuoteId = cd.details.id as string;
        await supabase
          .from('projects')
          .update({ zoho_estimate_id: activeQuoteId })
          .eq('id', projectId);
        markZohoIdFresh(activeQuoteId);
        queryClient.invalidateQueries({ queryKey: ['project_zoho_ids', projectId] });
      }

      // 1. Daten ins Quote pushen (Items + Custom-Fields). Quoted_Items
      //    werden ersetzt, nicht angehängt.
      const payload = buildQuotePayload({
        projectName,
        customerName: props.customerName,
        calcData,
        zusatz,
        validity: 30,
        layoutId,
        contractStart: calcData?.config_json?.contract_start || undefined,
      });
      const { Layout: _layout, ...updatePayload } = payload;
      const upd = await zohoClient.updateQuoteReplaceItems(activeQuoteId, updatePayload);
      const updResp = upd?.data?.[0];
      if (!updResp || (updResp.code && updResp.code !== 'SUCCESS')) {
        throw new Error(updResp?.message || 'Quote-Update fehlgeschlagen');
      }

      // 2. PDF lokal erzeugen — exakt das HTML, das in der Vorschau steht.
      const pdfBlob = await generateAngebotPdf({
        projectName,
        projectId,
        calcData,
        zusatz,
        customerName: props.customerName,
        customerNumber: enrichedProps.customerNumber,
        customerAddress: props.customerAddress,
        contactPerson: props.contactPerson,
        angebotNumber: enrichedProps.angebotNumber,
        ansprechpartner: props.ansprechpartner,
      });

      // 3. Als versionierten Anhang am Quote ablegen.
      const fileName = `Angebot_${enrichedProps.angebotNumber || activeQuoteId}_${timestampForFilename()}.pdf`;
      const attachResp = await zohoClient.attachToQuote(activeQuoteId, pdfBlob, fileName);
      const attachmentId = attachResp?.data?.[0]?.details?.id || null;

      // 4. Document-Record für die App-eigene Dokumentenliste.
      await supabase.from('documents').insert({
        project_id: projectId,
        document_type: 'angebot',
        file_name: fileName,
        file_url: `https://crm.zoho.eu/crm/org/Quotes/${activeQuoteId}`,
        file_size: pdfBlob.size,
        zoho_attachment_id: attachmentId,
      });

      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['zoho-quote-meta', activeQuoteId] });

      toast.success(`PDF "${fileName}" als Anhang gespeichert.`, { duration: 6000 });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[AngebotPreviewDialog] save failed:', err);
      toast.error('Fehler beim Speichern: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              PDF Vorschau – Angebot
              {enrichedProps.angebotNumber && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  · {enrichedProps.angebotNumber}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                disabled={downloading || saving}
                size="sm"
                variant="outline"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Herunterladen
              </Button>
              <Button onClick={handleSaveToZoho} disabled={saving || downloading} size="sm">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                In Zoho-Anhänge speichern
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/20">
          <iframe
            srcDoc={html}
            className="w-full h-full border-0 bg-white"
            title="HTML Vorschau"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
