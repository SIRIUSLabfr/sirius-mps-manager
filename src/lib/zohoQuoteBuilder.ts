import { zohoClient, QUOTE_INVENTORY_TEMPLATE_ID } from './zohoClient';

interface BuildQuotePayloadInput {
  projectName: string;
  customerName?: string;
  dealId?: string;
  contactZohoId?: string;
  accountZohoId?: string;
  calcData: any;
  zusatz: any;
  validity?: number; // days
  layoutId?: string;
  contractStart?: string; // ISO date for Vertragsbeginn
}

// Local finance_type -> Zoho Auswahlliste_1 picklist value.
// Confirmed values seen in the org: "Leasing", "Eigenmiete", "Kauf und/oder WV", "All-In".
const FINANCE_TYPE_TO_PICKLIST: Record<string, string> = {
  leasing: 'Leasing',
  eigenmiete: 'Eigenmiete',
  miete: 'Eigenmiete',
  kauf_wartung: 'Kauf und/oder WV',
  kauf_wv: 'Kauf und/oder WV',
  allin: 'All-In',
  all_in: 'All-In',
};

const num = (v: any): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Build a Zoho CRM Quote payload from the local calculation.
 * Includes line items (Product_Details), service block, and custom fields.
 */
export function buildQuotePayload(input: BuildQuotePayloadInput): Record<string, any> {
  const cfg = input.calcData?.config_json || {};
  const groups = cfg.device_groups || cfg.deviceGroups || [];
  const calc = cfg.calculated || {};
  const mixServiceItems: any[] = cfg.mix_service_items || cfg.service?.items || [];

  // ---- Line items: every line MUST have a Zoho product reference ----
  const quotedItems: any[] = [];

  // Zoho IDs are numeric strings (long). Reject UUIDs, "manual-…", empty.
  const isZohoId = (v: any): boolean => {
    if (v === null || v === undefined) return false;
    return /^\d{6,}$/.test(String(v));
  };

  groups.forEach((g: any, idx: number) => {
    const main = g.mainDevice || null;
    const productId = isZohoId(main?.id) ? main.id : (isZohoId(g.zoho_product_id) ? g.zoho_product_id : null);
    if (!productId) return;

    const qty = g.mainQuantity || g.quantity || 1;
    const unitPrice = main?.price ?? g.priceVk ?? g.vk ?? g.priceEk ?? g.ek ?? 0;
    const productName =
      main?.name || `${g.manufacturer || ''} ${g.model || ''}`.trim() || `Gerät ${idx + 1}`;

    quotedItems.push({
      Product_Name: { id: productId, name: productName },
      Quantity: qty,
      List_Price: unitPrice,
      Discount: 0,
    });

    (g.accessories || []).forEach((acc: any) => {
      if (!isZohoId(acc?.id)) return;
      quotedItems.push({
        Product_Name: { id: acc.id, name: acc.name },
        Quantity: acc.quantity || qty,
        List_Price: acc.price || 0,
        Discount: 0,
      });
    });
  });

  mixServiceItems.forEach((it: any) => {
    const p = it.product;
    if (!isZohoId(p?.id)) return;
    quotedItems.push({
      Product_Name: { id: p.id, name: p.name },
      Quantity: it.quantity || 1,
      List_Price: p.price || 0,
      Discount: 0,
    });
  });

  // Quoted_Items is mandatory and Zoho requires a real Product_Name.id per row.
  // If we have no linked Zoho product, throw a clear, actionable error instead
  // of sending an invalid empty/idless subform.
  if (quotedItems.length === 0) {
    throw new Error(
      'Keine mit Zoho verknüpften Produkte in der Kalkulation. Bitte mindestens ein Gerät über die Zoho-Produktsuche zuweisen, bevor das Angebot in Zoho erstellt wird.'
    );
  }

  // ---- Custom Kalkulation fields (Standard layout "Details Kalkulation") ----
  const financeType = input.calcData?.finance_type as string | undefined;
  const termMonths = num(input.calcData?.term_months);
  const monthlyRate = num(input.calcData?.total_monthly_rate);
  const serviceRate = num(input.calcData?.service_rate);
  const leasingFactor = num(input.calcData?.leasing_factor);
  const marginTotal = num(input.calcData?.margin_total);
  const hardwareEk = num(input.calcData?.total_hardware_ek);
  const volumeBw = num(calc.total_volume_bw ?? calc.totalSwVolume);
  const volumeColor = num(calc.total_volume_color ?? calc.totalColorVolume);
  const folgeBw = num(calc.folgeseitenpreis_sw ?? cfg.folgeseitenpreis_sw);
  const folgeColor = num(calc.folgeseitenpreis_farbe ?? cfg.folgeseitenpreis_farbe);
  const scanVolume = num(calc.total_volume_scan ?? cfg.scan_volume);
  const scanPrice = num(calc.folgeseitenpreis_scan ?? cfg.folgeseitenpreis_scan);

  // Leasinganteil = Hardwarefinanzierung im monatlichen Mix
  // (Gesamtrate minus Servicepauschale). Negative oder NaN -> undefined.
  const leasingPortion = monthlyRate !== undefined && serviceRate !== undefined
    ? Math.max(0, monthlyRate - serviceRate)
    : undefined;

  // Rate je nach Vertragsart in das passende Feld
  const rateFields: Record<string, number | undefined> = {};
  if (monthlyRate !== undefined && financeType) {
    if (financeType === 'leasing') rateFields.Leasingrate = monthlyRate;
    else if (financeType === 'eigenmiete' || financeType === 'miete') rateFields.Mietrate = monthlyRate;
    else if (financeType === 'allin' || financeType === 'all_in') rateFields.All_In_Rate = monthlyRate;
  }

  // Zusatzvereinbarungen-Block als Fließtext für Zoho-Feld
  const zusatzText = [
    input.zusatz?.mietfreie_startphase ? `Mietfreie Startphase: ${input.zusatz.mietfreie_startphase}` : '',
    input.zusatz?.berechnungsintervall ? `Berechnungsintervall: ${input.zusatz.berechnungsintervall}` : '',
    ...((input.zusatz?.items || [])
      .filter((it: any) => it.active && it.text?.trim())
      .map((it: any, i: number) => `${i + 1}. ${it.text}`)),
  ].filter(Boolean).join('\n');

  // ---- Quote payload ----
  const payload: Record<string, any> = {
    Subject: input.projectName?.trim() || `Angebot ${new Date().toLocaleDateString('de-DE')}`,
    Quote_Stage: 'In Arbeit',
    Layout: input.layoutId ? { id: input.layoutId } : undefined,
    Valid_Till: input.validity
      ? new Date(Date.now() + input.validity * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined,
    Deal_Name: input.dealId ? { id: input.dealId } : undefined,
    Contact_Name: input.contactZohoId ? { id: input.contactZohoId } : undefined,
    Account_Name: input.accountZohoId ? { id: input.accountZohoId } : undefined,
    Quoted_Items: quotedItems,

    // -------- Layout "Details Kalkulation" (Custom Fields) --------
    Auswahlliste_1: financeType ? (FINANCE_TYPE_TO_PICKLIST[financeType] || financeType) : undefined,
    Vertragsbeginn: input.contractStart || undefined,
    Vertragslaufzeit: termMonths !== undefined ? `${termMonths} Monate` : undefined, // text
    Laufzeit_Vertrag: termMonths,   // bigint
    Anzahl_Monate: termMonths,
    Leasingfaktor: leasingFactor,
    Leasinganteil: leasingPortion,
    Wartungsanteil: serviceRate,
    Marge: marginTotal,
    Summe_UHG: hardwareEk,
    S_W_Seitenmenge: volumeBw,
    Farbseitenmenge: volumeColor,
    S_W_Seitenpreis: folgeBw,
    Farbseitenpreis: folgeColor,
    Folgeseite_Scan: scanPrice,
    Scans: scanVolume,
    Zusatzvereinbarungen: zusatzText || undefined,
    ...rateFields,

    Description: [
      financeType ? `Vertragsart: ${FINANCE_TYPE_TO_PICKLIST[financeType] || financeType}` : '',
      termMonths !== undefined ? `Laufzeit: ${termMonths} Monate` : '',
      leasingFactor !== undefined ? `Leasingfaktor: ${leasingFactor}` : '',
      marginTotal !== undefined ? `Marge: ${marginTotal}` : '',
      monthlyRate !== undefined ? `Monatliche Gesamtrate: ${monthlyRate} €` : '',
      serviceRate !== undefined ? `Service-Pauschale: ${serviceRate} €` : '',
      volumeBw !== undefined ? `S/W-Volumen: ${volumeBw} Seiten/Monat` : '',
      volumeColor !== undefined ? `Farb-Volumen: ${volumeColor} Seiten/Monat` : '',
      folgeBw !== undefined ? `Folgeseiten S/W: ${folgeBw} €` : '',
      folgeColor !== undefined ? `Folgeseiten Farbe: ${folgeColor} €` : '',
      zusatzText ? `\nZusatzvereinbarungen:\n${zusatzText}` : '',
    ].filter(Boolean).join('\n'),
  };

  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  return payload;
}

export { QUOTE_INVENTORY_TEMPLATE_ID, zohoClient };
