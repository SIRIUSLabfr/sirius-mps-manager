import type { Zusatzvereinbarungen } from '@/components/angebot/ZusatzvereinbarungenCard';

interface PdfInput {
  projectName: string;
  projectId: string;
  calcData: {
    finance_type: string;
    term_months: number;
    total_monthly_rate: number;
    total_hardware_ek: number;
    service_rate: number;
    config_json: any;
  };
  zusatz: Zusatzvereinbarungen;
  version?: number;
}

const financeLabels: Record<string, string> = {
  leasing: 'Leasing (Bank)',
  eigenmiete: 'Eigenmiete (SIRIUS)',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  allin: 'All-In-Vertrag',
};

const fmtEuro = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtPrice4 = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' €';
const fmtNumber = (n: number) => n.toLocaleString('de-DE');

const intervallLabels: Record<string, string> = {
  monatlich: 'monatlich',
  quartalsweise: 'quartalsweise',
  halbjaehrlich: 'halbjährlich',
  jaehrlich: 'jährlich',
};

const startphaseLabels: Record<string, string> = {
  keine: 'Keine',
  '1_monat': '1 Monat',
  '2_monate': '2 Monate',
  '3_monate': '3 Monate',
  individuell: 'Individuell',
};

const COLORS = {
  primary: '#003DA5',
  accent: '#00A3E0',
  dark: '#172A45',
  bg: '#F4F7FC',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#D5E0F0',
  white: '#FFFFFF',
};

function buildFooter(): string {
  return `<div style="position:relative;margin-top:auto;padding-top:20px;border-top:1px solid ${COLORS.border};display:flex;justify-content:space-between;align-items:center;font-size:8px;color:${COLORS.muted};">
    <span>SIRIUS document solutions · Abrichstraße 23 · 79108 Freiburg · (0761) 704070</span>
  </div>`;
}

function buildCoverPage(input: PdfInput, today: Date, gueltigBis: Date): string {
  const fmtDate = (d: Date) => d.toLocaleDateString('de-DE');
  return `
  <div style="page-break-after:always;min-height:282mm;display:flex;flex-direction:column;padding:0;">
    <!-- Top accent bar -->
    <div style="height:8px;background:linear-gradient(90deg,${COLORS.primary},${COLORS.accent});"></div>
    
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20mm;">
      <!-- Logo -->
      <div style="margin-bottom:60px;">
        <div style="font-size:42px;font-weight:800;color:${COLORS.primary};letter-spacing:4px;font-family:Arial,Helvetica,sans-serif;">SIRIUS</div>
        <div style="font-size:12px;color:${COLORS.muted};margin-top:4px;letter-spacing:2px;">document solutions.</div>
      </div>
      
      <!-- Divider -->
      <div style="width:80px;height:3px;background:linear-gradient(90deg,${COLORS.primary},${COLORS.accent});margin:0 auto 50px;"></div>
      
      <!-- Title -->
      <div style="font-size:28px;font-weight:700;color:${COLORS.primary};letter-spacing:1px;margin-bottom:16px;">KOSTENVORANSCHLAG</div>
      
      <!-- Customer -->
      <div style="font-size:18px;color:${COLORS.dark};font-weight:500;margin-bottom:8px;">${input.projectName}</div>
      
      <!-- Meta -->
      <div style="font-size:11px;color:${COLORS.muted};margin-bottom:50px;">
        ${input.calcData.config_json?.projectNumber ? input.calcData.config_json.projectNumber + ' · ' : ''}${fmtDate(today)}
      </div>
      
      <!-- Ansprechpartner -->
      <div style="background:${COLORS.bg};border-radius:8px;padding:20px 32px;text-align:center;margin-bottom:30px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${COLORS.muted};margin-bottom:8px;">Ihr Ansprechpartner</div>
        <div style="font-size:13px;font-weight:600;color:${COLORS.dark};">SIRIUS document solutions</div>
        <div style="font-size:11px;color:${COLORS.muted};margin-top:4px;">info@sirius-gmbh.de · (0761) 704070</div>
      </div>
      
      <!-- Gültig bis -->
      <div style="font-size:10px;color:${COLORS.muted};">Gültig bis: ${fmtDate(gueltigBis)}</div>
    </div>
    
    <!-- Bottom footer -->
    <div style="padding:0 20mm 10mm;font-size:8px;color:${COLORS.muted};text-align:center;">
      SIRIUS document solutions · Abrichstraße 23 · 79108 Freiburg · (0761) 704070 · info@sirius-gmbh.de
    </div>
  </div>`;
}

function buildPositionsPages(deviceGroups: any[]): string {
  if (!deviceGroups.length) return '';

  let html = `<div class="page-break" style="padding:15mm 20mm 20mm;">
    <!-- Section header -->
    <div style="display:flex;align-items:center;margin-bottom:24px;">
      <div style="width:4px;height:24px;background:${COLORS.primary};border-radius:2px;margin-right:12px;"></div>
      <div style="font-size:18px;font-weight:700;color:${COLORS.primary};">Positionen</div>
    </div>`;

  let posCounter = 0;
  let isFirstGroup = true;

  for (const group of deviceGroups) {
    if (!group.mainDevice) continue;

    if (!isFirstGroup) {
      html += `<div style="height:20px;"></div>`;
    }
    isFirstGroup = false;

    // Location header
    if (group.label) {
      html += `<div style="background:${COLORS.primary};color:${COLORS.white};padding:8px 16px;font-size:11px;font-weight:700;border-radius:4px;margin-bottom:12px;letter-spacing:0.5px;">
        STANDORT: ${group.label}
      </div>`;
    }

    // Table
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <thead>
        <tr style="border-bottom:2px solid ${COLORS.primary};">
          <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;width:40px;">Pos</th>
          <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;">Bezeichnung</th>
          <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;width:60px;">Menge</th>
          <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;width:100px;">Einzelpreis</th>
          <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;width:100px;">Gesamt</th>
        </tr>
      </thead>
      <tbody>`;

    // Main device
    posCounter++;
    const mainName = group.mainDevice?.Product_Name || group.mainDevice?.name || 'Gerät';
    const mainPrice = group.mainDevice?.Unit_Price || group.mainDevice?.ek_preis || 0;
    const mainQty = group.mainQuantity || 1;
    html += buildPositionRow(posCounter, mainName, mainQty, mainPrice, false);

    // Accessories
    for (const acc of (group.accessories || [])) {
      posCounter++;
      const accName = acc.product?.Product_Name || acc.product?.name || 'Zubehör';
      const accPrice = acc.product?.Unit_Price || acc.product?.ek_preis || 0;
      const accQty = acc.quantity || 1;
      html += buildPositionRow(posCounter, accName, accQty, accPrice, posCounter % 2 === 0);
    }

    html += `</tbody></table>`;

    // Page prices
    if (group.page_prices?.bw || group.page_prices?.color) {
      html += `<div style="background:${COLORS.bg};border-left:3px solid ${COLORS.accent};padding:10px 16px;margin-top:8px;border-radius:0 4px 4px 0;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.muted};font-weight:700;margin-bottom:6px;">Seitenpreise</div>`;
      if (group.page_prices.bw) {
        const vol = group.page_prices.bw_volume || '';
        html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:${COLORS.text};margin-bottom:2px;">
          <span>Seitenpreis S/W${vol ? ` (${fmtNumber(vol)} Seiten/Monat)` : ''}</span>
          <span style="font-weight:600;">${fmtPrice4(group.page_prices.bw)}</span>
        </div>`;
      }
      if (group.page_prices.color) {
        const vol = group.page_prices.color_volume || '';
        html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:${COLORS.text};">
          <span>Seitenpreis Farbe${vol ? ` (${fmtNumber(vol)} Seiten/Monat)` : ''}</span>
          <span style="font-weight:600;">${fmtPrice4(group.page_prices.color)}</span>
        </div>`;
      }
      html += `</div>`;
    }
  }

  html += buildFooter();
  html += `</div>`;
  return html;
}

function buildPositionRow(pos: number, name: string, qty: number, price: number, stripe: boolean): string {
  const bg = stripe ? `background:${COLORS.bg};` : '';
  const total = qty * price;
  return `<tr style="border-bottom:1px solid ${COLORS.border};${bg}">
    <td style="padding:8px 10px;font-size:11px;color:${COLORS.muted};">${pos}</td>
    <td style="padding:8px 10px;font-size:11px;color:${COLORS.text};font-weight:500;">${name}</td>
    <td style="text-align:right;padding:8px 10px;font-size:11px;color:${COLORS.text};">${qty}</td>
    <td style="text-align:right;padding:8px 10px;font-size:11px;color:${COLORS.text};">${fmtEuro(price)}</td>
    <td style="text-align:right;padding:8px 10px;font-size:11px;color:${COLORS.text};font-weight:600;">${fmtEuro(total)}</td>
  </tr>`;
}

function buildSummaryPage(input: PdfInput, totalDevices: number, swVolume: number, colorVolume: number, folgeseitenSw: number, folgeseitenFarbe: number): string {
  const { calcData } = input;

  let rateSection = '';
  if (calcData.finance_type === 'kauf_wartung') {
    rateSection = `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${COLORS.muted};margin-bottom:8px;">Hardware Kaufpreis</div>
        <div style="font-size:32px;font-weight:800;color:${COLORS.primary};">${fmtEuro(calcData.total_hardware_ek)}</div>
        <div style="font-size:12px;color:${COLORS.muted};margin-top:6px;">Wartungsvertrag mtl.: ${fmtEuro(calcData.service_rate || 0)}</div>
      </div>`;
  } else if (calcData.finance_type === 'eigenmiete') {
    const mietrate = (calcData.total_monthly_rate || 0) - (calcData.service_rate || 0);
    rateSection = `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${COLORS.muted};margin-bottom:8px;">Monatliche Gesamtrate</div>
        <div style="font-size:32px;font-weight:800;color:${COLORS.primary};">${fmtEuro(calcData.total_monthly_rate || 0)}</div>
        <div style="font-size:12px;color:${COLORS.muted};margin-top:6px;">Mietrate: ${fmtEuro(mietrate)} · Servicerate: ${fmtEuro(calcData.service_rate || 0)}</div>
      </div>`;
  } else {
    // Leasing / All-In
    const hwRate = (calcData.total_monthly_rate || 0) - (calcData.service_rate || 0);
    rateSection = `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${COLORS.muted};margin-bottom:8px;">Monatliche Rate</div>
        <div style="font-size:32px;font-weight:800;color:${COLORS.primary};">${fmtEuro(calcData.total_monthly_rate || 0)}</div>
        <div style="font-size:12px;color:${COLORS.muted};margin-top:6px;">Hardware: ${fmtEuro(hwRate)} · Service: ${fmtEuro(calcData.service_rate || 0)}</div>
      </div>`;
  }

  return `
  <div class="page-break" style="padding:15mm 20mm 20mm;display:flex;flex-direction:column;min-height:262mm;">
    <!-- Section header -->
    <div style="display:flex;align-items:center;margin-bottom:32px;">
      <div style="width:4px;height:24px;background:${COLORS.primary};border-radius:2px;margin-right:12px;"></div>
      <div style="font-size:18px;font-weight:700;color:${COLORS.primary};">Zusammenfassung</div>
    </div>
    
    <!-- KPI cards -->
    <div style="display:flex;gap:16px;margin-bottom:32px;">
      <div style="flex:1;background:${COLORS.bg};border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.muted};margin-bottom:4px;">Geräte</div>
        <div style="font-size:24px;font-weight:800;color:${COLORS.dark};">${totalDevices}</div>
      </div>
      <div style="flex:1;background:${COLORS.bg};border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.muted};margin-bottom:4px;">Laufzeit</div>
        <div style="font-size:24px;font-weight:800;color:${COLORS.dark};">${calcData.term_months}</div>
        <div style="font-size:9px;color:${COLORS.muted};">Monate</div>
      </div>
      <div style="flex:1;background:${COLORS.bg};border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.muted};margin-bottom:4px;">Finanzierung</div>
        <div style="font-size:13px;font-weight:700;color:${COLORS.dark};margin-top:6px;">${financeLabels[calcData.finance_type] || calcData.finance_type}</div>
      </div>
    </div>
    
    <!-- Rate -->
    ${rateSection}
    
    <!-- Volume + Folgeseitenpreise -->
    <div style="display:flex;gap:16px;margin-bottom:32px;">
      <div style="flex:1;border:1px solid ${COLORS.border};border-radius:8px;padding:16px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;margin-bottom:10px;">Inklusivvolumen</div>
        <div style="font-size:11px;color:${COLORS.text};margin-bottom:4px;">S/W: <strong>${fmtNumber(swVolume)}</strong> Seiten/Monat</div>
        <div style="font-size:11px;color:${COLORS.text};">Farbe: <strong>${fmtNumber(colorVolume)}</strong> Seiten/Monat</div>
      </div>
      <div style="flex:1;border:1px solid ${COLORS.border};border-radius:8px;padding:16px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.primary};font-weight:700;margin-bottom:10px;">Folgeseitenpreise</div>
        <div style="font-size:11px;color:${COLORS.text};margin-bottom:4px;">S/W: <strong>${fmtPrice4(folgeseitenSw)}</strong></div>
        <div style="font-size:11px;color:${COLORS.text};">Farbe: <strong>${fmtPrice4(folgeseitenFarbe)}</strong></div>
      </div>
    </div>
    
    ${buildFooter()}
  </div>`;
}

function buildZusatzPage(zusatz: Zusatzvereinbarungen): string {
  const items: string[] = [];
  if (zusatz.lieferpauschale_active) items.push(`Lieferpauschale inkl. Basiseinweisung: ${fmtEuro(zusatz.lieferpauschale_betrag)}`);
  if (zusatz.basiseinweisung_active) items.push(`Basiseinweisung: ${zusatz.basiseinweisung_text}`);
  if (zusatz.it_installation_active) items.push(`Komplette IT-Installation: ${zusatz.it_installation_text}`);
  if (zusatz.abholung_altgeraete_active) {
    items.push(`Abholung der Altgeräte: ${zusatz.abholung_altgeraete_type === 'kostenlos' ? 'kostenlos' : `Pauschale ${fmtEuro(zusatz.abholung_altgeraete_betrag)}`}`);
  }
  if (zusatz.mietfreie_startphase !== 'keine') items.push(`Mietfreie Startphase: ${startphaseLabels[zusatz.mietfreie_startphase]}`);
  if (zusatz.erhoehbar_active) items.push(`Erhöhbar: ${zusatz.erhoehbar_prozent}% p.a.`);
  items.push(`Berechnungsintervall Zähler: ${intervallLabels[zusatz.berechnungsintervall] || zusatz.berechnungsintervall}`);
  if (zusatz.sonderkuendigungsrecht_active && zusatz.sonderkuendigungsrecht_text) {
    items.push(`Sonderkündigungsrecht: ${zusatz.sonderkuendigungsrecht_text}`);
  }
  if (zusatz.weitere_vereinbarung) items.push(zusatz.weitere_vereinbarung);

  if (items.length === 0) return '';

  const itemsHtml = items.map(item =>
    `<div style="display:flex;align-items:flex-start;margin-bottom:10px;">
      <div style="width:20px;height:20px;border-radius:50%;background:${COLORS.accent};color:${COLORS.white};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-right:12px;margin-top:1px;">✓</div>
      <div style="font-size:11px;color:${COLORS.text};line-height:1.5;">${item}</div>
    </div>`
  ).join('');

  return `
  <div style="margin-top:32px;padding:20px 24px;background:${COLORS.bg};border-radius:8px;border:1px solid ${COLORS.border};">
    <div style="font-size:13px;font-weight:700;color:${COLORS.primary};margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">Zusatzvereinbarungen</div>
    ${itemsHtml}
  </div>`;
}

export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  const { calcData, zusatz } = input;
  const config = calcData.config_json || {};
  const deviceGroups = config.deviceGroups || [];
  const calculated = config.calculated || {};
  const folgeseitenSw = calculated.folgeseitenpreis_sw || config.folgeseitenpreis_sw || 0;
  const folgeseitenFarbe = calculated.folgeseitenpreis_farbe || config.folgeseitenpreis_farbe || 0;
  const swVolume = calculated.totalSwVolume || 0;
  const colorVolume = calculated.totalColorVolume || 0;
  const today = new Date();
  const gueltigBis = new Date(today);
  gueltigBis.setDate(gueltigBis.getDate() + 30);

  const totalDevices = deviceGroups.reduce((s: number, g: any) => s + (g.mainQuantity || 0), 0);

  // Build the full HTML document
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};font-size:11px;line-height:1.5;width:210mm;">
    ${buildCoverPage(input, today, gueltigBis)}
    ${buildPositionsPages(deviceGroups)}
    ${buildSummaryPage(input, totalDevices, swVolume, colorVolume, folgeseitenSw, folgeseitenFarbe)}
    ${buildZusatzPage(zusatz) ? `
    <div style="padding:0 20mm;">
      ${buildZusatzPage(zusatz)}
    </div>` : ''}
  </div>`;

  // Render off-screen
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = html;
  document.body.appendChild(container);

  const version = input.version || 1;
  const fileName = `KV_${input.projectName.replace(/\s+/g, '_')}_${today.toISOString().split('T')[0]}_v${version}.pdf`;

  const blob: Blob = await html2pdf()
    .set({
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break' },
    })
    .from(container)
    .output('blob');

  document.body.removeChild(container);
  return blob;
}
