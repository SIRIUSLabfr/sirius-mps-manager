import type { Zusatzvereinbarungen, ZusatzItem } from '@/components/angebot/ZusatzvereinbarungenCard';
import { RADIO_OPTIONS } from '@/components/angebot/ZusatzvereinbarungenCard';

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
  showPrices?: boolean;
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

const C = {
  primary: '#003DA5',
  accent: '#00A3E0',
  dark: '#172A45',
  bg: '#F4F7FC',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#D5E0F0',
  white: '#FFFFFF',
  lightMuted: '#B8C9DB',
};

function footer(): string {
  return `<div style="padding:8px 0;border-top:1px solid ${C.border};display:flex;justify-content:space-between;font-size:7.5px;color:${C.muted};margin-top:auto;">
    <span>SIRIUS document solutions · Abrichstr. 23 · 79108 Freiburg · (0761) 704070 · info@sirius-gmbh.de</span>
  </div>`;
}

function coverPage(input: PdfInput, today: Date, gueltigBis: Date): string {
  const fmtDate = (d: Date) => d.toLocaleDateString('de-DE');
  const contact = input.contactPerson || '';
  const customerName = input.customerName || input.projectName;
  const custNum = input.customerNumber || '';
  const angNum = input.angebotNumber || '';

  return `
  <div style="page-break-after:always;min-height:282mm;display:flex;flex-direction:column;padding:15mm 20mm 15mm;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <img src="/sirius-logo.png" style="width:180px;height:auto;" alt="SIRIUS" />
      <div style="text-align:right;font-size:8px;color:${C.muted};line-height:1.6;">
        SIRIUS GmbH · Abrichstr. 23 · 79108 Freiburg<br/>
        Tel: (0761) 704070 · info@sirius-gmbh.de
      </div>
    </div>

    <!-- Empfänger + Meta -->
    <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
      <div style="font-size:11px;color:${C.text};line-height:1.6;">
        <div style="font-weight:700;font-size:13px;">${customerName}</div>
        ${contact ? `<div>${contact}</div>` : ''}
        ${input.customerAddress ? `<div>${input.customerAddress}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:10px;color:${C.muted};line-height:1.8;">
        ${custNum ? `<div>KD-NR: <strong style="color:${C.text}">${custNum}</strong></div>` : ''}
        ${angNum ? `<div>AN-NR: <strong style="color:${C.text}">${angNum}</strong></div>` : ''}
      </div>
    </div>

    <!-- Accent line -->
    <div style="width:48px;height:3px;background:${C.accent};margin-bottom:24px;"></div>

    <!-- Title -->
    <div style="font-size:28px;font-weight:700;color:${C.dark};margin-bottom:8px;">ANGEBOT</div>
    <div style="font-size:18px;color:${C.primary};font-weight:500;margin-bottom:28px;">${input.projectName} – ${customerName}</div>

    <!-- Anschreiben -->
    <div style="font-size:11px;color:${C.text};line-height:1.7;margin-bottom:28px;">
      Sehr geehrte${contact ? ('/r ' + contact) : ' Damen und Herren'},<br/><br/>
      nochmals vielen Dank für Ihr Interesse an unserem SIRIUS Print Konzept. Gerne unterbreiten wir Ihnen folgendes Angebot für die Optimierung Ihrer Druckerlandschaft.
      Wir sind überzeugt, dass Sie von unserem umfassenden All-In-Service profitieren werden. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.
    </div>

    <!-- Info box -->
    <div style="border-left:4px solid ${C.accent};background:${C.bg};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:10px;color:${C.text};">
        <div><span style="color:${C.muted};">Datum:</span> <strong>${fmtDate(today)}</strong></div>
        <div><span style="color:${C.muted};">Gültig bis:</span> <strong>${fmtDate(gueltigBis)}</strong></div>
        ${angNum ? `<div><span style="color:${C.muted};">Angebotsnr.:</span> <strong>${angNum}</strong></div>` : ''}
        ${input.ansprechpartner?.name ? `<div><span style="color:${C.muted};">Ihr Ansprechpartner:</span> <strong>${input.ansprechpartner.name}</strong></div>` : ''}
      </div>
    </div>

    <!-- Team image on cover -->
    <div style="margin-top:auto;margin-bottom:12px;">
      <img src="/images/sirius-team-1.jpg" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;" alt="SIRIUS Team" />
    </div>

    ${footer()}
  </div>`;
}

function devicePages(deviceGroups: any[], showPrices: boolean): string {
  if (!deviceGroups.length) return '';

  let html = '';
  let posCounter = 0;

  for (const group of deviceGroups) {
    if (!group.mainDevice) continue;

    html += `<div class="page-break" style="padding:15mm 20mm 15mm;display:flex;flex-direction:column;min-height:262mm;">`;

    // Location header
    const loc = group.label || 'Standort';
    html += `<div style="background:${C.dark};color:${C.white};padding:10px 16px;font-size:11px;font-weight:700;border-radius:4px;margin-bottom:16px;letter-spacing:0.5px;">
      STANDORT: ${loc}
    </div>`;

    // Main device card
    const mainName = group.mainDevice?.Product_Name || group.mainDevice?.name || 'Gerät';
    const mainQty = group.mainQuantity || 1;
    const imgUrl = group.mainDevice?.Bild_URL1 || group.mainDevice?.image_url || '';
    const description = group.mainDevice?.Description || group.mainDevice?.description || '';
    const datasheetUrl = group.mainDevice?.Bild_URL || group.mainDevice?.datasheet_url || '';

    html += `<div style="display:flex;gap:16px;border:1px solid ${C.border};border-radius:8px;padding:14px;margin-bottom:16px;">`;
    if (imgUrl) {
      html += `<img src="${imgUrl}" style="width:120px;height:120px;object-fit:contain;border-radius:6px;background:${C.bg};" />`;
    } else {
      html += `<div style="width:120px;height:120px;background:${C.bg};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:36px;color:${C.border};">🖨</div>`;
    }
    html += `<div style="flex:1;">
      <div style="font-size:14px;font-weight:700;color:${C.dark};margin-bottom:4px;">${mainName}</div>
      <div style="font-size:12px;color:${C.primary};font-weight:600;margin-bottom:6px;">${mainQty} Stück</div>
      ${description ? `<div style="font-size:11px;color:#4b5563;line-height:1.5;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">${description}</div>` : ''}
      ${datasheetUrl ? `<div style="margin-top:6px;"><a href="${datasheetUrl}" style="font-size:10px;color:${C.accent};text-decoration:none;">📎 Datenblatt</a></div>` : ''}
    </div></div>`;

    // Accessories table
    const accessories = group.accessories || [];
    if (accessories.length > 0) {
      const priceHeaders = showPrices
        ? `<th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.primary};font-weight:700;width:90px;">Einzelpreis</th>
           <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.primary};font-weight:700;width:90px;">Gesamt</th>`
        : '';

      html += `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead><tr style="border-bottom:2px solid ${C.primary};">
          <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.primary};font-weight:700;width:40px;">Pos</th>
          <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.primary};font-weight:700;">Bezeichnung</th>
          <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.primary};font-weight:700;width:60px;">Menge</th>
          ${priceHeaders}
        </tr></thead><tbody>`;

      for (const acc of accessories) {
        posCounter++;
        const accName = acc.product?.Product_Name || acc.product?.name || 'Zubehör';
        const accPrice = acc.product?.Unit_Price || acc.product?.ek_preis || 0;
        const accQty = acc.quantity || 1;
        const stripe = posCounter % 2 === 0 ? `background:${C.bg};` : '';
        const priceCells = showPrices
          ? `<td style="text-align:right;padding:8px 10px;font-size:11px;color:${C.text};">${fmtEuro(accPrice)}</td>
             <td style="text-align:right;padding:8px 10px;font-size:11px;color:${C.text};font-weight:600;">${fmtEuro(accPrice * accQty)}</td>`
          : '';
        html += `<tr style="border-bottom:1px solid ${C.border};${stripe}">
          <td style="padding:8px 10px;font-size:11px;color:${C.muted};">${posCounter}</td>
          <td style="padding:8px 10px;font-size:11px;color:${C.text};font-weight:500;">${accName}</td>
          <td style="text-align:right;padding:8px 10px;font-size:11px;color:${C.text};">${accQty}</td>
          ${priceCells}
        </tr>`;
      }
      html += `</tbody></table>`;
    }

    // Page prices
    if (group.page_prices?.bw || group.page_prices?.color) {
      html += `<div style="background:${C.bg};border-radius:6px;padding:10px 16px;margin-bottom:12px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.muted};font-weight:700;margin-bottom:6px;">Seitenpreise</div>`;
      if (group.page_prices.bw) {
        const vol = group.page_prices.bw_volume || '';
        html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:${C.text};margin-bottom:2px;">
          <span>S/W:${vol ? ` ${fmtNumber(vol)} Seiten/Monat →` : ''}</span>
          <span style="font-weight:600;">${fmtPrice4(group.page_prices.bw)}</span>
        </div>`;
      }
      if (group.page_prices.color) {
        const vol = group.page_prices.color_volume || '';
        html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:${C.text};">
          <span>Farbe:${vol ? ` ${fmtNumber(vol)} Seiten/Monat →` : ''}</span>
          <span style="font-weight:600;">${fmtPrice4(group.page_prices.color)}</span>
        </div>`;
      }
      html += `</div>`;
    }

    html += footer();
    html += `</div>`;
  }

  return html;
}

function konditionenPage(input: PdfInput, swVolume: number, colorVolume: number, folgeseitenSw: number, folgeseitenFarbe: number): string {
  const { calcData, zusatz } = input;

  // Rate box
  let rateLabel = 'MONATLICHE ALL-IN-RATE';
  let rateValue = calcData.total_monthly_rate || 0;
  let rateSub = '';

  if (calcData.finance_type === 'kauf_wartung') {
    rateLabel = 'HARDWARE KAUFPREIS';
    rateValue = calcData.total_hardware_ek;
    rateSub = `Wartungsvertrag mtl.: ${fmtEuro(calcData.service_rate || 0)}`;
  } else if (calcData.finance_type === 'eigenmiete') {
    rateLabel = 'MONATLICHE GESAMTRATE';
    const mietrate = (calcData.total_monthly_rate || 0) - (calcData.service_rate || 0);
    rateSub = `Mietrate: ${fmtEuro(mietrate)} · Servicerate: ${fmtEuro(calcData.service_rate || 0)}`;
  } else {
    const hwRate = (calcData.total_monthly_rate || 0) - (calcData.service_rate || 0);
    rateSub = `Hardware: ${fmtEuro(hwRate)} · Service: ${fmtEuro(calcData.service_rate || 0)}`;
  }

  const kondRows = [
    ['Vertragslaufzeit', `${calcData.term_months} Monate`],
    ['Seiten S/W', `${fmtNumber(swVolume)} Seiten/Monat`],
    ['Seiten Farbe', `${fmtNumber(colorVolume)} Seiten/Monat`],
    ['Folgeseite S/W', fmtPrice4(folgeseitenSw)],
    ['Folgeseite Farbe', fmtPrice4(folgeseitenFarbe)],
    ['Lieferpauschale inkl. Einweisung', 'Kostenfrei'],
    ['Urheberrechtsabgabe (UHG)', 'pro Gerät'],
    ['EDV-Installation', '35,00 € / 15 Min (nach Aufwand)'],
    ['Mietfreie Startphase', startphaseLabels[zusatz.mietfreie_startphase] || zusatz.mietfreie_startphase],
    ['Berechnungsintervall', intervallLabels[zusatz.berechnungsintervall] || zusatz.berechnungsintervall],
  ];

  const kondTableHtml = kondRows.map((r, i) => {
    const bg = i % 2 === 0 ? C.bg : C.white;
    return `<tr style="background:${bg};">
      <td style="padding:8px 14px;font-size:11px;color:${C.muted};width:45%;">${r[0]}</td>
      <td style="padding:8px 14px;font-size:11px;color:${C.text};font-weight:500;">${r[1]}</td>
    </tr>`;
  }).join('');

  // Zusatzvereinbarungen
  const items = zusatz.items || [];
  const activeItems = items.map((item, idx) => ({ ...item, idx })).filter(i => i.active && i.text);
  let zusatzHtml = '';
  if (activeItems.length > 0) {
    let counter = 0;
    zusatzHtml = `<div style="margin-top:24px;">
      <div style="font-size:13px;font-weight:700;color:${C.primary};margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">Zusatzvereinbarungen</div>`;
    for (const item of activeItems) {
      counter++;
      zusatzHtml += `<div style="border-left:3px solid ${C.primary};padding:8px 14px;margin-bottom:8px;background:${C.bg};border-radius:0 4px 4px 0;">
        <div style="font-size:11px;color:${C.text};line-height:1.6;"><strong>${counter}.</strong> ${item.text}</div>`;

      // Radio options for items 10-11 (idx 9-10) - fixed options
      const radioOpts = RADIO_OPTIONS[item.idx];
      if (radioOpts) {
        zusatzHtml += `<div style="margin-top:6px;padding-left:16px;">`;
        for (const opt of radioOpts) {
          const checked = item.selectedOption === opt.value;
          zusatzHtml += `<div style="font-size:10px;color:${C.text};margin-bottom:3px;">
            ${checked ? '☑' : '☐'} ${opt.label}${opt.price ? ` (${opt.price})` : ''}
          </div>`;
        }
        zusatzHtml += `</div>`;
      }

      // Custom options for item 12 (idx 11)
      if (item.idx === 11 && item.customOptions && item.customOptions.length > 0) {
        zusatzHtml += `<div style="margin-top:6px;padding-left:16px;">`;
        for (const opt of item.customOptions) {
          const checked = item.selectedOption === opt.value;
          zusatzHtml += `<div style="font-size:10px;color:${C.text};margin-bottom:3px;">
            ${checked ? '☑' : '☐'} ${opt.label}${opt.price ? ` (${opt.price})` : ''}
          </div>`;
        }
        zusatzHtml += `</div>`;
      }

      zusatzHtml += `</div>`;
    }
    zusatzHtml += `</div>`;
  }

  return `
  <div class="page-break" style="padding:15mm 20mm 15mm;display:flex;flex-direction:column;min-height:262mm;">
    <div style="display:flex;align-items:center;margin-bottom:24px;">
      <div style="width:4px;height:24px;background:${C.primary};border-radius:2px;margin-right:12px;"></div>
      <div style="font-size:18px;font-weight:700;color:${C.primary};">Konditionen & Vereinbarungen</div>
    </div>

    <!-- Rate box -->
    <div style="background:${C.dark};border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${C.lightMuted};margin-bottom:8px;">${rateLabel}</div>
      <div style="font-size:28px;font-weight:800;color:${C.accent};">${fmtEuro(rateValue)}</div>
      ${rateSub ? `<div style="font-size:11px;color:${C.lightMuted};margin-top:6px;">${rateSub}</div>` : ''}
    </div>

    <!-- Konditionen table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:6px;overflow:hidden;border:1px solid ${C.border};">
      ${kondTableHtml}
    </table>

    <!-- Enthaltene Leistungen -->
    <div style="background:${C.bg};border-radius:6px;padding:12px 16px;font-size:10px;color:${C.muted};line-height:1.6;margin-bottom:16px;">
      <strong style="color:${C.text};">Enthaltene Leistungen:</strong> Die Nutzungsrate enthält: Finanzierung der Geräte, sämtliche Wartungsarbeiten, Reparaturen (inkl. Anfahrt und Arbeitszeit), Ersatzteile und alle Verbrauchsmaterialien. <strong>Nicht enthalten:</strong> Papier, EDV-Dienstleistungen.
    </div>

    ${zusatzHtml}

    <div style="font-size:10px;color:${C.text};margin-top:20px;font-style:italic;">
      Mit Ihrer Unterschrift bestätigen Sie die Annahme des Angebots.
    </div>

    ${footer()}
  </div>`;
}

function signaturePage(input: PdfInput): string {
  const ap = input.ansprechpartner;
  const initials = ap?.name
    ? ap.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'SI';

  return `
  <div class="page-break" style="padding:15mm 20mm 15mm;display:flex;flex-direction:column;min-height:262mm;">
    <div style="display:flex;align-items:center;margin-bottom:32px;">
      <div style="width:4px;height:24px;background:${C.primary};border-radius:2px;margin-right:12px;"></div>
      <div style="font-size:18px;font-weight:700;color:${C.primary};">Ihr Ansprechpartner</div>
    </div>

    ${ap ? `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:40px;">
      <div style="width:44px;height:44px;border-radius:50%;background:${C.primary};color:${C.white};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;">${initials}</div>
      <div>
        <div style="font-size:14px;font-weight:700;color:${C.dark};">${ap.name}</div>
        ${ap.role ? `<div style="font-size:11px;color:${C.muted};">${ap.role}</div>` : ''}
        ${ap.email ? `<div style="font-size:11px;color:${C.accent};">${ap.email}</div>` : ''}
        ${ap.phone ? `<div style="font-size:11px;color:${C.text};">${ap.phone}</div>` : ''}
      </div>
    </div>` : ''}

    <!-- Signature area -->
    <div style="border:2px dashed ${C.border};border-radius:8px;padding:24px;margin-bottom:auto;">
      <div style="font-size:12px;font-weight:600;color:${C.dark};margin-bottom:20px;">Auftragsbestätigung</div>
      <div style="font-size:10px;color:${C.muted};margin-bottom:32px;">
        Mit Ihrer Unterschrift bestätigen Sie die Annahme des Angebots zu den oben genannten Konditionen.
      </div>
      <div style="display:flex;gap:40px;">
        <div style="flex:1;">
          <div style="border-bottom:1px solid ${C.dark};margin-bottom:6px;height:40px;"></div>
          <div style="font-size:9px;color:${C.muted};">Ort, Datum</div>
        </div>
        <div style="flex:1;">
          <div style="border-bottom:1px solid ${C.dark};margin-bottom:6px;height:40px;"></div>
          <div style="font-size:9px;color:${C.muted};">Unterschrift / Stempel</div>
        </div>
      </div>
    </div>

    ${footer()}
  </div>`;
}

export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  const { calcData, zusatz } = input;
  const config = calcData.config_json || {};
  const deviceGroups = config.device_groups || config.deviceGroups || [];
  const calculated = config.calculated || {};
  const folgeseitenSw = calculated.folgeseitenpreis_sw || config.folgeseitenpreis_sw || 0;
  const folgeseitenFarbe = calculated.folgeseitenpreis_farbe || config.folgeseitenpreis_farbe || 0;
  const swVolume = calculated.total_volume_bw || calculated.totalSwVolume || 0;
  const colorVolume = calculated.total_volume_color || calculated.totalColorVolume || 0;
  const today = new Date();
  const gueltigBis = new Date(today);
  gueltigBis.setDate(gueltigBis.getDate() + 30);

  const fullHtml = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:${C.text};font-size:11px;line-height:1.5;width:210mm;">
    ${coverPage(input, today, gueltigBis)}
    ${devicePages(deviceGroups, !!input.showPrices)}
    ${konditionenPage(input, swVolume, colorVolume, folgeseitenSw, folgeseitenFarbe)}
    ${signaturePage(input)}
  </div>`;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.style.height = '0';
  wrapper.style.overflow = 'hidden';
  wrapper.style.zIndex = '-9999';
  wrapper.style.opacity = '0';
  wrapper.style.pointerEvents = 'none';

  const container = document.createElement('div');
  container.style.width = '210mm';
  container.innerHTML = fullHtml;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  // Temporarily make visible for html2canvas rendering
  wrapper.style.height = 'auto';
  wrapper.style.overflow = 'visible';

  const version = input.version || 1;
  const fileName = `KV_${input.projectName.replace(/\s+/g, '_')}_${today.toISOString().split('T')[0]}_v${version}.pdf`;

  const blob: Blob = await html2pdf()
    .set({
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break' } as any,
    })
    .from(container)
    .output('blob');

  document.body.removeChild(wrapper);
  return blob;
}
