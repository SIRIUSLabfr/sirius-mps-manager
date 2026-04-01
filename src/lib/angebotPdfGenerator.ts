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
}

const financeLabels: Record<string, string> = {
  leasing: 'Leasing (Bank)',
  eigenmiete: 'Eigenmiete (SIRIUS)',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  allin: 'All-In-Vertrag',
};

const fmt = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

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

export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
  // Use html2pdf.js which is already a dependency
  const html2pdf = (await import('html2pdf.js')).default;

  const { projectName, calcData, zusatz } = input;
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
  const fmtDate = (d: Date) => d.toLocaleDateString('de-DE');

  const totalDevices = deviceGroups.reduce((s: number, g: any) => s + (g.mainQuantity || 0), 0);

  // Build HTML
  let html = `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 11px; line-height: 1.5;">
    <!-- DECKBLATT -->
    <div style="page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px;">
      <div style="margin-bottom: 40px;">
        <div style="font-size: 28px; font-weight: 800; color: #003DA5; letter-spacing: 2px;">SIRIUS</div>
        <div style="font-size: 10px; color: #666; margin-top: 2px;">document solutions.</div>
      </div>
      <div style="width: 80px; height: 3px; background: linear-gradient(90deg, #003DA5, #00A3E0); margin: 30px auto;"></div>
      <h1 style="font-size: 22px; font-weight: 700; color: #003DA5; margin: 20px 0;">KOSTENVORANSCHLAG</h1>
      <p style="font-size: 14px; margin: 10px 0;">${projectName}</p>
      <div style="margin-top: 40px; font-size: 11px; color: #666;">
        <p>Datum: ${fmtDate(today)}</p>
        <p>Gültig bis: ${fmtDate(gueltigBis)}</p>
      </div>
      <div style="margin-top: 60px; font-size: 10px; color: #999;">
        <p>SIRIUS document solutions</p>
        <p>Abrichstraße 23 · 79108 Freiburg</p>
        <p>Tel: (0761) 704070</p>
      </div>
    </div>

    <!-- POSITIONEN -->
    <div style="padding: 40px;">
      <h2 style="font-size: 16px; font-weight: 700; color: #003DA5; margin-bottom: 20px;">Positionen</h2>
  `;

  let posCounter = 0;
  for (const group of deviceGroups) {
    if (!group.mainDevice) continue;
    if (group.label) {
      html += `<div style="background: #003DA5; color: white; padding: 6px 12px; font-size: 11px; font-weight: 700; margin: 16px 0 8px; border-radius: 3px;">STANDORT: ${group.label}</div>`;
    }
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      <thead><tr style="border-bottom: 2px solid #003DA5;">
        <th style="text-align: left; padding: 4px 6px; font-size: 10px; color: #003DA5;">Pos</th>
        <th style="text-align: left; padding: 4px 6px; font-size: 10px; color: #003DA5;">Bezeichnung</th>
        <th style="text-align: right; padding: 4px 6px; font-size: 10px; color: #003DA5;">Menge</th>
        <th style="text-align: right; padding: 4px 6px; font-size: 10px; color: #003DA5;">Einzelpreis</th>
      </tr></thead><tbody>`;

    posCounter++;
    const mainName = group.mainDevice?.Product_Name || group.mainDevice?.name || 'Gerät';
    const mainPrice = group.mainDevice?.Unit_Price || group.mainDevice?.ek_preis || 0;
    html += `<tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 4px 6px;">${posCounter}</td>
      <td style="padding: 4px 6px;">${mainName}</td>
      <td style="text-align: right; padding: 4px 6px;">${group.mainQuantity || 1}</td>
      <td style="text-align: right; padding: 4px 6px;">${fmt(mainPrice)} €</td>
    </tr>`;

    for (const acc of (group.accessories || [])) {
      posCounter++;
      html += `<tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 4px 6px;">${posCounter}</td>
        <td style="padding: 4px 6px;">${acc.product?.Product_Name || acc.product?.name || 'Zubehör'}</td>
        <td style="text-align: right; padding: 4px 6px;">${acc.quantity || 1}</td>
        <td style="text-align: right; padding: 4px 6px;">${fmt(acc.product?.Unit_Price || acc.product?.ek_preis || 0)} €</td>
      </tr>`;
    }

    // Page prices
    if (group.page_prices?.bw || group.page_prices?.color) {
      html += `<tr><td colspan="4" style="padding: 8px 6px 4px; font-size: 10px; color: #666;">
        <strong>Seitenpreise:</strong><br/>`;
      if (group.page_prices.bw) html += `S/W: ${fmt4(group.page_prices.bw)} €/Seite<br/>`;
      if (group.page_prices.color) html += `Farbe: ${fmt4(group.page_prices.color)} €/Seite`;
      html += `</td></tr>`;
    }

    html += `</tbody></table>`;
  }

  // Zusammenfassung
  html += `
    </div>
    <div style="page-break-before: always; padding: 40px;">
      <h2 style="font-size: 16px; font-weight: 700; color: #003DA5; margin-bottom: 20px;">Zusammenfassung</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Vertragsart</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${financeLabels[calcData.finance_type] || calcData.finance_type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Laufzeit</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${calcData.term_months} Monate</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Geräteanzahl</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${totalDevices}</td>
          </tr>`;

  if (calcData.finance_type === 'kauf_wartung') {
    html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Hardware Kaufpreis</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${fmt(calcData.total_hardware_ek)} €</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Wartungsvertrag mtl.</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${fmt(calcData.service_rate || 0)} €</td>
          </tr>`;
  } else {
    html += `
          <tr style="border-bottom: 2px solid #003DA5;">
            <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #003DA5;">Monatliche Gesamtrate</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px; font-weight: 700; color: #003DA5;">${fmt(calcData.total_monthly_rate || 0)} €</td>
          </tr>`;
  }

  html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Inkl. S/W-Volumen</td>
            <td style="padding: 6px 0; text-align: right;">${swVolume.toLocaleString('de-DE')} Seiten/Monat</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Inkl. Farb-Volumen</td>
            <td style="padding: 6px 0; text-align: right;">${colorVolume.toLocaleString('de-DE')} Seiten/Monat</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Folgeseitenpreis S/W</td>
            <td style="padding: 6px 0; text-align: right;">${fmt4(folgeseitenSw)} €</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 6px 0; color: #666;">Folgeseitenpreis Farbe</td>
            <td style="padding: 6px 0; text-align: right;">${fmt4(folgeseitenFarbe)} €</td>
          </tr>
        </tbody>
      </table>`;

  // Zusatzvereinbarungen
  const zusatzItems: string[] = [];
  if (zusatz.lieferpauschale_active) zusatzItems.push(`Lieferpauschale: ${fmt(zusatz.lieferpauschale_betrag)} €`);
  if (zusatz.basiseinweisung_active) zusatzItems.push(`Basiseinweisung: ${zusatz.basiseinweisung_text}`);
  if (zusatz.it_installation_active) zusatzItems.push(`IT-Installation: ${zusatz.it_installation_text}`);
  if (zusatz.abholung_altgeraete_active) {
    zusatzItems.push(`Abholung Altgeräte: ${zusatz.abholung_altgeraete_type === 'kostenlos' ? 'Kostenlos' : `Pauschale ${fmt(zusatz.abholung_altgeraete_betrag)} €`}`);
  }
  if (zusatz.mietfreie_startphase !== 'keine') zusatzItems.push(`Mietfreie Startphase: ${startphaseLabels[zusatz.mietfreie_startphase]}`);
  if (zusatz.erhoehbar_active) zusatzItems.push(`Erhöhbar: ${zusatz.erhoehbar_prozent}% p.a.`);
  zusatzItems.push(`Berechnungsintervall Zähler: ${intervallLabels[zusatz.berechnungsintervall] || zusatz.berechnungsintervall}`);
  if (zusatz.sonderkuendigungsrecht_active && zusatz.sonderkuendigungsrecht_text) {
    zusatzItems.push(`Sonderkündigungsrecht: ${zusatz.sonderkuendigungsrecht_text}`);
  }
  if (zusatz.weitere_vereinbarung) zusatzItems.push(zusatz.weitere_vereinbarung);

  if (zusatzItems.length > 0) {
    html += `
      <h3 style="font-size: 13px; font-weight: 700; color: #003DA5; margin: 24px 0 12px;">Zusatzvereinbarungen</h3>
      <ul style="margin: 0; padding-left: 18px;">
        ${zusatzItems.map(i => `<li style="margin-bottom: 4px; font-size: 11px;">${i}</li>`).join('')}
      </ul>`;
  }

  // Footer
  html += `
      <div style="margin-top: 60px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center;">
        SIRIUS document solutions · Abrichstraße 23 · 79108 Freiburg · Tel: (0761) 704070
      </div>
    </div>
  </div>`;

  // Generate PDF
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const blob: Blob = await html2pdf()
    .set({
      margin: 0,
      filename: 'angebot.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(container)
    .outputPdf('blob');

  document.body.removeChild(container);
  return blob;
}
