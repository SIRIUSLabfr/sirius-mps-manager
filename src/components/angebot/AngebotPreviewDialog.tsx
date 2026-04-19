import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { zohoClient, QUOTE_INVENTORY_TEMPLATE_ID } from '@/lib/zohoClient';
import { buildQuotePayload } from '@/lib/zohoQuoteBuilder';
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

const fmt2 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const today = new Date().toLocaleDateString('de-DE');

/**
 * Builds the HTML preview matching the SIRIUS Zoho-template (v4),
 * pre-filled with live calculation + project data.
 */
function buildPreviewHtml(p: Props): string {
  const calc = p.calcData?.config_json?.calculated || {};
  const groups = p.calcData?.config_json?.device_groups || p.calcData?.config_json?.deviceGroups || [];
  const cfg = p.calcData?.config_json || {};

  const swVolume = calc.total_volume_bw || 0;
  const colorVolume = calc.total_volume_color || 0;
  const folgeSw = calc.folgeseitenpreis_sw || cfg.folgeseitenpreis_sw || 0;
  const folgeFarbe = calc.folgeseitenpreis_farbe || cfg.folgeseitenpreis_farbe || 0;
  const monthlyRate = p.calcData?.total_monthly_rate || calc.total_rate || 0;
  const term = p.calcData?.term_months || 60;
  const contractStart = cfg.contract_start
    ? new Date(cfg.contract_start).toLocaleDateString('de-DE')
    : '–';
  const deliveryDate = cfg.delivery_date
    ? new Date(cfg.delivery_date).toLocaleDateString('de-DE')
    : '–';

  const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString('de-DE');

  // Address parsing from project warehouse_address (free-form)
  const addressLines = (p.customerAddress || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const street = addressLines[0] || '';
  const cityLine = addressLines.slice(1).join(', ') || '';

  // Device rows
  const deviceRows = groups
    .map((g: any, idx: number) => {
      const name = `${g.manufacturer || g.mainDevice?.manufacturer || ''} ${
        g.model || g.mainDevice?.model || g.mainDevice?.name || ''
      }`.trim() || `Gerät ${idx + 1}`;
      const desc = [g.options, g.accessories?.map?.((a: any) => a.product?.name).filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(' · ');
      const qty = g.mainQuantity || g.quantity || 1;
      return `
        <tr>
          <td>
            <div class="p-name">${name}</div>
            ${desc ? `<div class="p-desc">${desc}</div>` : ''}
          </td>
          <td><div class="p-desc">${desc || '–'}</div></td>
          <td class="p-qty">${qty}</td>
        </tr>`;
    })
    .join('');

  // Active Zusatzvereinbarungen
  const activeZusatz = (p.zusatz?.items || [])
    .filter(it => it.active && it.text?.trim())
    .map((it, i) => `<div class="z-item"><span class="z-num">${i + 1}</span>${it.text}</div>`)
    .join('');

  return `
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Angebot Vorschau</title>
<style>
  body { font-family: "Inter", "Segoe UI", sans-serif; font-size: 11px; line-height: 1.6; color: #334155; background: #FFFFFF; margin: 0; padding: 0; }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; background: #fff; }
  .header { padding: 24px 36px 20px; display: table; width: 100%; border-bottom: 1.5px solid #E2E8F0; box-sizing: border-box; }
  .header-left { display: table-cell; vertical-align: middle; width: 45%; font-weight: 700; font-size: 14px; color: #3B6BC3; letter-spacing: -0.02em; }
  .header-right { display: table-cell; vertical-align: middle; width: 55%; text-align: right; font-size: 8px; color: #94A3B8; line-height: 1.7; letter-spacing: 0.02em; }
  .content { padding: 28px 36px 20px; }
  .meta-row { display: table; width: 100%; margin-bottom: 28px; }
  .meta-left { display: table-cell; vertical-align: top; width: 56%; }
  .meta-right { display: table-cell; vertical-align: top; width: 44%; text-align: right; }
  .sender-line { font-size: 7px; color: #94A3B8; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; margin-bottom: 12px; }
  .recipient-name { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 4px; letter-spacing: -0.02em; }
  .recipient-detail { font-size: 10px; color: #64748B; line-height: 1.7; }
  .meta-label { font-size: 7px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 500; margin-bottom: 1px; }
  .meta-value { font-size: 10px; color: #334155; margin-bottom: 10px; font-weight: 500; }
  .doc-title { font-size: 26px; font-weight: 800; color: #0F172A; margin-bottom: 6px; letter-spacing: -0.03em; line-height: 1.1; }
  .doc-title span { color: #3B6BC3; }
  .title-sub { font-size: 10px; color: #94A3B8; font-weight: 400; margin-bottom: 20px; }
  .title-sub strong { color: #334155; font-weight: 600; }
  .anschreiben { font-size: 10px; color: #475569; line-height: 1.85; margin-bottom: 28px; max-width: 460px; }
  .anschreiben p { margin: 0 0 8px; }

  .section-header { font-size: 13px; font-weight: 700; color: #0F172A; margin: 28px 0 4px; display: flex; align-items: center; }
  .section-num { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: #3B6BC3; color: #FFFFFF; font-size: 10px; font-weight: 700; text-align: center; line-height: 22px; margin-right: 8px; }
  .section-line { height: 1px; margin-bottom: 14px; background: linear-gradient(90deg, #CBD5E1, transparent 70%); }

  .ptable { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .ptable thead th { background: #F8FAFC; color: #64748B; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px; text-align: left; border-bottom: 1.5px solid #E2E8F0; }
  .ptable thead th:last-child { text-align: center; width: 70px; }
  .ptable tbody td { padding: 7px 12px; border-bottom: 0.5px solid #F1F5F9; vertical-align: top; }
  .p-name { font-weight: 600; color: #0F172A; font-size: 11px; }
  .p-desc { font-size: 9px; color: #94A3B8; line-height: 1.4; }
  .p-qty { text-align: center; font-weight: 600; color: #334155; }

  .ktable { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
  .ktable td { padding: 7px 0; border-bottom: 0.5px solid #F1F5F9; font-size: 10px; vertical-align: top; }
  .ktable td:first-child { color: #64748B; width: 58%; }
  .ktable td:last-child { text-align: right; font-weight: 600; color: #0F172A; }
  .k-highlight td { padding: 12px 14px !important; border-bottom: none; font-size: 12px; background: #F0F5FF; }
  .k-highlight td:first-child { font-weight: 600; color: #1E293B; border-radius: 8px 0 0 8px; }
  .k-highlight td:last-child { font-size: 18px; font-weight: 800; color: #3B6BC3; border-radius: 0 8px 8px 0; }

  .l-box { background: #F8FAFC; border-left: 3px solid #3B6BC3; padding: 12px 16px; font-size: 9px; color: #475569; line-height: 1.8; margin: 16px 0 20px; border-radius: 0 8px 8px 0; }
  .l-box strong { color: #0F172A; font-weight: 600; }

  .z-title { font-size: 11px; font-weight: 700; color: #3B6BC3; letter-spacing: 0.04em; text-transform: uppercase; margin: 20px 0 10px; }
  .z-item { font-size: 10px; color: #475569; line-height: 1.8; margin-bottom: 5px; padding-left: 2px; }
  .z-num { display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: #EFF6FF; color: #3B6BC3; font-size: 8px; font-weight: 700; text-align: center; line-height: 16px; margin-right: 6px; }

  .ap-card { display: inline-block; width: 46%; vertical-align: top; margin-right: 3%; padding: 12px 14px; background: #F8FAFC; border-radius: 8px; margin-bottom: 8px; box-sizing: border-box; }
  .ap-role { font-size: 7px; text-transform: uppercase; letter-spacing: 0.1em; color: #3B6BC3; font-weight: 700; margin-bottom: 3px; }
  .ap-name { font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 3px; }
  .ap-detail { font-size: 9px; color: #94A3B8; line-height: 1.7; }

  .footer { border-top: 1.5px solid #E2E8F0; padding: 14px 36px; display: table; width: 100%; margin-top: 28px; box-sizing: border-box; }
  .footer-text { font-size: 8px; color: #94A3B8; line-height: 1.7; text-align: center; }

  .placeholder-tag { background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
</style></head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">SIRIUS GmbH</div>
    <div class="header-right">
      SIRIUS GmbH document solutions<br>
      Abrichstr. 23 · 79108 Freiburg<br>
      (0761) 704070 · info@sirius-gmbh.de
    </div>
  </div>

  <div class="content">
    <div class="meta-row">
      <div class="meta-left">
        <div class="sender-line">SIRIUS GmbH · Abrichstr. 23 · 79108 Freiburg</div>
        <div class="recipient-name">${p.customerName || '<span class="placeholder-tag">Kundenname</span>'}</div>
        <div class="recipient-detail">
          ${street || '<span class="placeholder-tag">Straße</span>'}<br>
          ${cityLine || '<span class="placeholder-tag">PLZ Ort</span>'}
        </div>
      </div>
      <div class="meta-right">
        <div class="meta-label">KD-NR</div>
        <div class="meta-value">${p.customerNumber || '–'}</div>
        <div class="meta-label">Angebot</div>
        <div class="meta-value">${p.angebotNumber || '<span class="placeholder-tag">wird vergeben</span>'}</div>
        <div class="meta-label">Datum</div>
        <div class="meta-value">${today}</div>
        <div class="meta-label">Gültig bis</div>
        <div class="meta-value">${validUntil}</div>
      </div>
    </div>

    <div class="doc-title">Ihr individuelles<br><span>Angebot.</span></div>
    <div class="title-sub">Ihr Ansprechpartner: <strong>${p.ansprechpartner?.name || '–'}</strong></div>

    <div class="anschreiben">
      <p>Sehr geehrte/r ${p.contactPerson || p.customerName || 'Kunde'},</p>
      <p>vielen Dank für Ihr Interesse an unserem SIRIUS Print Konzept. Nachfolgend erhalten Sie Ihren individuellen Lösungsvorschlag.</p>
      <p>Wir freuen uns, wenn das Angebot Ihre Erwartungen erfüllt. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen<br>${p.ansprechpartner?.name || 'SIRIUS Team'}</p>
    </div>

    <div class="section-header"><span class="section-num">1</span>Soll-Empfehlung – Geräte</div>
    <div class="section-line"></div>

    <table class="ptable">
      <thead><tr><th>Artikel</th><th>Beschreibung</th><th>Menge</th></tr></thead>
      <tbody>
        ${deviceRows || '<tr><td colspan="3" style="text-align:center;color:#94A3B8;padding:18px;">Keine Geräte in der Kalkulation</td></tr>'}
      </tbody>
    </table>

    <div class="section-header"><span class="section-num">2</span>Konditionen und Zusatzvereinbarungen</div>
    <div class="section-line"></div>

    <table class="ktable k-highlight">
      <tr><td>Die monatliche Nutzungsrate beträgt:</td><td>${fmt2(monthlyRate)} €</td></tr>
    </table>

    <table class="ktable">
      <tr><td>Vertragslaufzeit</td><td>${term} Monate</td></tr>
      <tr><td>Vertragsbeginn</td><td>${contractStart}</td></tr>
      <tr><td>Lieferdatum</td><td>${deliveryDate}</td></tr>
      <tr><td>Seiten in S/W</td><td>${swVolume.toLocaleString('de-DE')} Seiten/Monat</td></tr>
      <tr><td>Seiten in Color</td><td>${colorVolume.toLocaleString('de-DE')} Seiten/Monat</td></tr>
      <tr><td>Preis pro Folgeseite SW</td><td>${fmt4(folgeSw)} €</td></tr>
      <tr><td>Preis pro Folgeseite Color</td><td>${fmt4(folgeFarbe)} €</td></tr>
      <tr><td>Lieferpauschale inkl. Basiseinweisung</td><td>Kostenfrei</td></tr>
    </table>

    <div class="l-box">
      Beinhaltet die komplette Vorinstallation mit Prüfung und Test der Maschine in unserer Werkstatt.
      Lieferung an den Arbeitsplatz und Entsorgung der Verpackung.
      <br><br>
      <strong>Zahlung:</strong> Zzgl. der zum Zeitpunkt der Leistung gültigen gesetzlichen MwSt.
      Sofern eine Einzugsermächtigung erteilt wird, gewähren wir 2% Skonto auf den monatlichen Rechnungsbetrag (Leasing ausgenommen).
    </div>

    ${activeZusatz ? `
      <div class="z-title">Zusatzvereinbarungen</div>
      ${activeZusatz}
    ` : ''}

    <div class="section-header"><span class="section-num">3</span>Ihre Ansprechpartner</div>
    <div class="section-line"></div>

    <div>
      <div class="ap-card">
        <div class="ap-role">Ihr Ansprechpartner</div>
        <div class="ap-name">${p.ansprechpartner?.name || '–'}</div>
        <div class="ap-detail">
          ${p.ansprechpartner?.phone ? `Tel: ${p.ansprechpartner.phone}<br>` : ''}
          ${p.ansprechpartner?.email ? `Mail: ${p.ansprechpartner.email}` : ''}
        </div>
      </div>
      <div class="ap-card">
        <div class="ap-role">Service & Technik</div>
        <div class="ap-name">SIRIUS Service-Hotline</div>
        <div class="ap-detail">
          Tel: (0761) 704070<br>
          Mail: service@sirius-gmbh.de
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">
      SIRIUS GmbH document solutions · Abrichstr. 23 · 79108 Freiburg<br>
      Geschäftsführer: Fabian Schüler, Michael Wangerowski, Manfred Schüler<br>
      Registergericht: Amtsgericht Freiburg · HRB 2624
    </div>
  </div>
</div>
</body></html>`;
}

export default function AngebotPreviewDialog(props: Props) {
  const { open, onOpenChange, projectId, projectName, calcData, zusatz, quoteId } = props;
  const [loadingZoho, setLoadingZoho] = useState(false);
  const [zohoBlobUrl, setZohoBlobUrl] = useState<string | null>(null);

  const html = open ? buildPreviewHtml(props) : '';

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
