import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { zohoClient, QUOTE_INVENTORY_TEMPLATE_ID } from '@/lib/zohoClient';
import { buildQuotePayload } from '@/lib/zohoQuoteBuilder';
import { buildAngebotHtml } from '@/lib/angebotPreviewHtml';
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

export default function AngebotPreviewDialog(props: Props) {
  const { open, onOpenChange, projectId, projectName, calcData, zusatz, quoteId } = props;
  const [loadingZoho, setLoadingZoho] = useState(false);
  const [zohoBlobUrl, setZohoBlobUrl] = useState<string | null>(null);

  const html = open ? buildAngebotHtml(props, { forPdf: false }) : '';

  const handleLoadZohoVersion = async () => {
    setLoadingZoho(true);
    try {
      let id = quoteId;
      // Create a temporary draft if none exists
      if (!id) {
        toast.message('Lege temporäres Angebot in Zoho an…');
        const { data: projectRow } = await supabase
          .from('projects')
          .select('zoho_deal_id')
          .eq('id', projectId)
          .maybeSingle();

        let contactId: string | undefined;
        let accountId: string | undefined;
        if (projectRow?.zoho_deal_id) {
          const dealRes = await zohoClient.getDeal(projectRow.zoho_deal_id);
          contactId = dealRes?.data?.[0]?.Contact_Name?.id;
          accountId = dealRes?.data?.[0]?.Account_Name?.id;
        }

        const payload = buildQuotePayload({
          projectName,
          customerName: props.customerName,
          dealId: projectRow?.zoho_deal_id || undefined,
          contactZohoId: contactId,
          accountZohoId: accountId,
          calcData,
          zusatz,
          validity: 30,
        });
        const created = await zohoClient.createQuote(payload);
        const cd = created?.data?.[0];
        if (cd?.code !== 'SUCCESS') throw new Error(cd?.message || 'Quote-Erstellung fehlgeschlagen');
        id = cd.details.id;
        await supabase.from('projects').update({ zoho_estimate_id: id }).eq('id', projectId);
      }

      toast.message('Generiere PDF aus Zoho-Vorlage…');
      const blob = await zohoClient.getQuotePdf(id!, QUOTE_INVENTORY_TEMPLATE_ID);
      if (!blob) throw new Error('PDF konnte nicht geladen werden');
      const url = URL.createObjectURL(blob);
      setZohoBlobUrl(url);
      toast.success('Zoho-PDF geladen');
    } catch (err: any) {
      toast.error('Fehler: ' + (err.message || err));
    } finally {
      setLoadingZoho(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o && zohoBlobUrl) {
        URL.revokeObjectURL(zohoBlobUrl);
        setZohoBlobUrl(null);
      }
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              PDF Vorschau – Angebot
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadZohoVersion}
                disabled={loadingZoho}
              >
                {loadingZoho ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                {zohoBlobUrl ? 'Zoho-PDF geladen' : 'Original aus Zoho rendern'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/20">
          {zohoBlobUrl ? (
            <iframe
              src={zohoBlobUrl}
              className="w-full h-full border-0"
              title="Zoho PDF Vorschau"
            />
          ) : (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0 bg-white"
              title="HTML Vorschau"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
