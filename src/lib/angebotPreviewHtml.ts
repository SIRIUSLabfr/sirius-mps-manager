import type { Zusatzvereinbarungen } from '@/components/angebot/ZusatzvereinbarungenCard';

export interface AngebotPreviewInput {
  projectName: string;
  customerName?: string;
  customerNumber?: string;
  customerAddress?: string;
  contactPerson?: string;
  angebotNumber?: string;
  ansprechpartner?: { name: string; role?: string; email?: string; phone?: string } | null;
  calcData: {
    finance_type: string;
    term_months: number;
    total_monthly_rate: number;
    total_hardware_ek: number;
    service_rate: number;
    config_json: any;
  };
  zusatz: Zusatzvereinbarungen;
}

const fmt2 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Single source of truth für das Angebots-Layout.
 * Genutzt von:
 *   - AngebotPreviewDialog (Vorschau im iframe)
 *   - generateAngebotPdf (PDF-Export)
 *
 * Struktur: vier `[data-pdf-page]`-Sections, je eine pro PDF-Seite.
 * Der Generator rendert jede Section als eigenes Canvas → eigene Seite,
 * sodass es keine zerschnittenen Tabellen oder Texte gibt.
 *
 * Header (Logo) und Footer werden in jeder Section dupliziert, damit das
 * Layout konsistent bleibt und html2canvas alles in einem Rutsch sieht.
 */
export function buildAngebotHtml(p: AngebotPreviewInput, opts: { forPdf?: boolean } = {}): string {
  const forPdf = !!opts.forPdf;
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

  const today = new Date().toLocaleDateString('de-DE');
  const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString('de-DE');

  const addressLines = (p.customerAddress || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const street = addressLines[0] || '';
  const cityLine = addressLines.slice(1).join(', ') || '';

  const placeholder = (label: string) =>
    forPdf ? '–' : `<span class="placeholder-tag">${label}</span>`;

  const deviceRows = groups
    .map((g: any, idx: number) => {
      const name =
        `${g.manufacturer || g.mainDevice?.manufacturer || ''} ${
          g.model || g.mainDevice?.model || g.mainDevice?.name || ''
        }`.trim() || `Gerät ${idx + 1}`;
      const desc = [
        g.options,
        g.accessories?.map?.((a: any) => a.product?.name).filter(Boolean).join(', '),
      ]
        .filter(Boolean)
        .join(' · ');
      const qty = g.mainQuantity || g.quantity || 1;
      const standort = (g.label || '').trim();
      return `
        <tr>
          <td>
            <div class="p-name">${escapeHtml(name)}</div>
            ${standort ? `<div class="p-standort">📍 ${escapeHtml(standort)}</div>` : ''}
          </td>
          <td><div class="p-desc">${desc ? escapeHtml(desc) : '–'}</div></td>
          <td class="p-qty">${qty}</td>
        </tr>`;
    })
    .join('');

  const activeZusatz = (p.zusatz?.items || [])
    .filter((it) => it.active && it.text?.trim())
    .map(
      (it, i) =>
        `<div class="z-item"><span class="z-num">${i + 1}</span>${escapeHtml(it.text).replace(
          /\n/g,
          '<br>'
        )}</div>`
    )
    .join('');

  // Header + Footer pro Seite — auf jeder PDF-Page identisch wiederholen.
  const pageHeader = `
    <header class="page-header">
      <img src="/sirius-logo.png" class="logo" alt="SIRIUS" />
      <div class="page-header-right">
        SIRIUS GmbH document solutions<br>
        Abrichstr. 23 · 79108 Freiburg<br>
        (0761) 704070 · info@sirius-gmbh.de
      </div>
    </header>`;

  const pageFooter = `
    <footer class="page-footer">
      SIRIUS GmbH document solutions · Abrichstr. 23 · 79108 Freiburg ·
      Geschäftsführer: Fabian Schüler, Michael Wangerowski, Manfred Schüler ·
      Registergericht: Amtsgericht Freiburg · HRB 2624
    </footer>`;

  return `
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Angebot</title>
<style>
  body { font-family: "Inter", "Segoe UI", sans-serif; font-size: 11px; line-height: 1.6; color: #334155; background: #FFFFFF; margin: 0; padding: 0; }

  /* Eine PDF-Seite = ein .pdf-page Wrapper, A4 hoch (297mm), feste Breite. */
  .pdf-page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    box-sizing: border-box;
    padding: 0 0 28mm 0;
    position: relative;
    page-break-after: always;
  }
  .pdf-page:last-child { page-break-after: auto; }
  /* Vorschau im Browser: dezente Trennung zwischen den Seiten */
  body.preview .pdf-page + .pdf-page { margin-top: 12px; box-shadow: 0 -1px 0 #E2E8F0; }

  .page-header { padding: 18px 36px 14px; display: table; width: 100%; border-bottom: 1.5px solid #E2E8F0; box-sizing: border-box; }
  .page-header .logo { display: table-cell; vertical-align: middle; height: 42px; max-width: 180px; }
  .page-header-right { display: table-cell; vertical-align: middle; text-align: right; font-size: 8px; color: #94A3B8; line-height: 1.7; letter-spacing: 0.02em; }

  .content { padding: 24px 36px 24px; }

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

  .section-header { font-size: 13px; font-weight: 700; color: #0F172A; margin: 0 0 4px; display: flex; align-items: center; }
  .section-num { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: #3B6BC3; color: #FFFFFF; font-size: 10px; font-weight: 700; text-align: center; line-height: 22px; margin-right: 8px; }
  .section-line { height: 1px; margin-bottom: 14px; background: linear-gradient(90deg, #CBD5E1, transparent 70%); }

  .ptable { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .ptable thead th { background: #F8FAFC; color: #64748B; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px; text-align: left; border-bottom: 1.5px solid #E2E8F0; }
  .ptable thead th:last-child { text-align: center; width: 70px; }
  .ptable tbody td { padding: 7px 12px; border-bottom: 0.5px solid #F1F5F9; vertical-align: top; }
  .p-name { font-weight: 600; color: #0F172A; font-size: 11px; }
  .p-standort { font-size: 9px; color: #64748B; margin-top: 2px; }
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

  .ap-card { display: inline-block; width: 46%; vertical-align: top; margin-right: 3%; padding: 14px 16px; background: #F8FAFC; border-radius: 8px; margin-bottom: 10px; box-sizing: border-box; }
  .ap-role { font-size: 7px; text-transform: uppercase; letter-spacing: 0.1em; color: #3B6BC3; font-weight: 700; margin-bottom: 3px; }
  .ap-name { font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 3px; }
  .ap-detail { font-size: 9px; color: #94A3B8; line-height: 1.7; }

  .sdc-block {
    display: block;
    text-decoration: none;
    margin-top: 28px;
    background: #080813;
    color: #CCFFF7;
    border-radius: 10px;
    padding: 22px 24px;
    font-family: "Courier New", "Liberation Mono", monospace;
    box-shadow: 0 4px 16px rgba(8, 8, 19, 0.18);
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .sdc-block:hover { box-shadow: 0 6px 22px rgba(233, 82, 151, 0.28); }
  .sdc-tag {
    display: inline-block;
    font-size: 8px;
    letter-spacing: 0.18em;
    color: #4FB8CD;
    text-transform: uppercase;
    margin-bottom: 10px;
    padding: 2px 8px;
    border: 1px solid #4FB8CD;
    border-radius: 3px;
  }
  .sdc-title {
    font-size: 16px;
    font-weight: 700;
    color: #E95297;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .sdc-tagline {
    font-size: 11px;
    color: #CCFFF7;
    margin-bottom: 18px;
    letter-spacing: 0.04em;
  }
  .sdc-tagline em {
    color: #4FB8CD;
    font-style: normal;
    font-weight: 700;
  }
  .sdc-pillars {
    display: table;
    width: 100%;
    border-collapse: separate;
    border-spacing: 8px 0;
    margin-bottom: 18px;
  }
  .sdc-pillar {
    display: table-cell;
    width: 33.33%;
    padding: 12px 10px;
    background: rgba(204, 255, 247, 0.06);
    border: 1px solid rgba(79, 184, 205, 0.35);
    border-radius: 6px;
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #CCFFF7;
    text-transform: uppercase;
    vertical-align: middle;
  }
  .sdc-pillar strong { color: #E95297; display: block; margin-bottom: 2px; font-size: 10px; }
  .sdc-cta {
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    color: #4FB8CD;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding-top: 8px;
    border-top: 1px dashed rgba(204, 255, 247, 0.18);
  }
  .sdc-cta span { color: #E95297; }

  .page-footer { position: absolute; bottom: 10mm; left: 0; right: 0; padding: 0 36px; text-align: center; font-size: 7.5px; color: #94A3B8; line-height: 1.6; letter-spacing: 0.01em; }

  .placeholder-tag { background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
</style></head>
<body class="${forPdf ? '' : 'preview'}">

<!-- ============ SEITE 1 · ANSCHREIBEN ============ -->
<section class="pdf-page" data-pdf-page="1">
  ${pageHeader}
  <div class="content">
    <div class="meta-row">
      <div class="meta-left">
        <div class="sender-line">SIRIUS GmbH · Abrichstr. 23 · 79108 Freiburg</div>
        <div class="recipient-name">${p.customerName ? escapeHtml(p.customerName) : placeholder('Kundenname')}</div>
        <div class="recipient-detail">
          ${street ? escapeHtml(street) : placeholder('Straße')}<br>
          ${cityLine ? escapeHtml(cityLine) : placeholder('PLZ Ort')}
        </div>
      </div>
      <div class="meta-right">
        <div class="meta-label">KD-NR</div>
        <div class="meta-value">${p.customerNumber ? escapeHtml(p.customerNumber) : '–'}</div>
        <div class="meta-label">Angebot</div>
        <div class="meta-value">${p.angebotNumber ? escapeHtml(p.angebotNumber) : placeholder('wird vergeben')}</div>
        <div class="meta-label">Datum</div>
        <div class="meta-value">${today}</div>
        <div class="meta-label">Gültig bis</div>
        <div class="meta-value">${validUntil}</div>
      </div>
    </div>

    <div class="doc-title">Ihr individuelles<br><span>Angebot.</span></div>
    <div class="title-sub">Ihr Ansprechpartner: <strong>${p.ansprechpartner?.name ? escapeHtml(p.ansprechpartner.name) : '–'}</strong></div>

    <div class="anschreiben">
      <p>${p.contactPerson?.trim() ? `Sehr geehrte/r ${escapeHtml(p.contactPerson)}` : 'Sehr geehrte Damen und Herren'},</p>
      <p>vielen Dank für Ihr Interesse an unserem SIRIUS Print Konzept. Nachfolgend erhalten Sie Ihren individuellen Lösungsvorschlag.</p>
      <p>Wir freuen uns, wenn das Angebot Ihre Erwartungen erfüllt. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen<br>${p.ansprechpartner?.name ? escapeHtml(p.ansprechpartner.name) : 'SIRIUS Team'}</p>
    </div>
  </div>
  ${pageFooter}
</section>

<!-- ============ SEITE 2 · GERÄTE ============ -->
<section class="pdf-page" data-pdf-page="2">
  ${pageHeader}
  <div class="content">
    <div class="section-header"><span class="section-num">1</span>Soll-Empfehlung – Geräte</div>
    <div class="section-line"></div>

    <table class="ptable">
      <thead><tr><th>Artikel</th><th>Beschreibung</th><th>Menge</th></tr></thead>
      <tbody>
        ${deviceRows || '<tr><td colspan="3" style="text-align:center;color:#94A3B8;padding:18px;">Keine Geräte in der Kalkulation</td></tr>'}
      </tbody>
    </table>

    <div class="section-header" style="margin-top:32px;"><span class="section-num">2</span>Konditionen</div>
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
    </div>
  </div>
  ${pageFooter}
</section>

<!-- ============ SEITE 3 · ZUSATZVEREINBARUNGEN ============ -->
<section class="pdf-page" data-pdf-page="3">
  ${pageHeader}
  <div class="content">
    <div class="section-header"><span class="section-num">3</span>Zusatzvereinbarungen</div>
    <div class="section-line"></div>

    ${activeZusatz || '<p style="font-size:10px;color:#94A3B8;">Keine Zusatzvereinbarungen erfasst.</p>'}
  </div>
  ${pageFooter}
</section>

<!-- ============ SEITE 4 · KONTAKTDATEN ============ -->
<section class="pdf-page" data-pdf-page="4">
  ${pageHeader}
  <div class="content">
    <div class="section-header"><span class="section-num">4</span>Ihre Ansprechpartner</div>
    <div class="section-line"></div>

    <div>
      <div class="ap-card">
        <div class="ap-role">Ihr Ansprechpartner</div>
        <div class="ap-name">${p.ansprechpartner?.name ? escapeHtml(p.ansprechpartner.name) : '–'}</div>
        <div class="ap-detail">
          ${p.ansprechpartner?.phone ? `Tel: ${escapeHtml(p.ansprechpartner.phone)}<br>` : ''}
          ${p.ansprechpartner?.email ? `Mail: ${escapeHtml(p.ansprechpartner.email)}` : ''}
        </div>
      </div>
      <div class="ap-card">
        <div class="ap-role">Service &amp; Technik</div>
        <div class="ap-name">SIRIUS Service-Hotline</div>
        <div class="ap-detail">
          Tel: (0761) 704070<br>
          Mail: service@sirius-gmbh.de
        </div>
      </div>
    </div>

    <a class="sdc-block" href="https://www.smiling-data-club.de" target="_blank" rel="noopener noreferrer" data-sdc-link>
      <div class="sdc-tag">SDC · ONLINE</div>
      <div class="sdc-title">▸ SMILING DATA CLUB</div>
      <div class="sdc-tagline">
        Today's complexity. <em>Retro simplicity.</em>
      </div>
      <div class="sdc-pillars">
        <div class="sdc-pillar"><strong>ZOHO ONE</strong>CRM &amp; Workflow</div>
        <div class="sdc-pillar"><strong>DOCUWARE</strong>Dokumenten-Mgmt.</div>
        <div class="sdc-pillar"><strong>KI &amp; AUTO-<br/>MATISIERUNG</strong>End-to-End</div>
      </div>
      <div class="sdc-cta">
        ▸ JOIN THE CLUB <span>·</span> SMILING-DATA.CLUB ◂
      </div>
    </a>
  </div>
  ${pageFooter}
</section>

</body></html>`;
}
