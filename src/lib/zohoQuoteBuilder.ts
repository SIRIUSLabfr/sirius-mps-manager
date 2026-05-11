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

const intOrUndef = (v: any): number | undefined => {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n);
};

// Zoho date fields expect "YYYY-MM-DD". Tolerate Date, ISO datetime,
// and "DD.MM.YYYY" inputs, otherwise drop.
const isoDate = (v: any): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const m = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
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

  // Rate je nach Vertragsart in das passende Feld (case-insensitive)
  const rateFields: Record<string, number | undefined> = {};
  const ft = financeType?.toLowerCase();
  if (monthlyRate !== undefined && ft) {
    if (ft === 'leasing') rateFields.Leasingrate = monthlyRate;
    else if (ft === 'eigenmiete' || ft === 'miete') rateFields.Mietrate = monthlyRate;
    else if (ft === 'allin' || ft === 'all_in' || ft === 'all-in') rateFields.All_In_Rate = monthlyRate;
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
    Auswahlliste_1: financeType ? (FINANCE_TYPE_TO_PICKLIST[financeType.toLowerCase()] || financeType) : undefined,
    Vertragsbeginn: isoDate(input.contractStart),
    Vertragslaufzeit: termMonths !== undefined ? `${termMonths} Monate` : undefined, // text
    Laufzeit_Vertrag: intOrUndef(termMonths),   // bigint
    Anzahl_Monate: intOrUndef(termMonths),       // bigint
    Leasingfaktor: leasingFactor,
    Leasinganteil: leasingPortion,
    Wartungsanteil: serviceRate,
    Marge: marginTotal,
    Summe_UHG: hardwareEk,
    S_W_Seitenmenge: intOrUndef(volumeBw),       // bigint
    Farbseitenmenge: intOrUndef(volumeColor),    // bigint
    S_W_Seitenpreis: folgeBw,
    Farbseitenpreis: folgeColor,
    Folgeseite_Scan: scanPrice,
    Scans: intOrUndef(scanVolume),               // bigint
    Zusatzvereinbarungen: zusatzText || undefined,
    // Gesamtrate: monatliche All-In-Rate, unabhängig von Vertragsart.
    Gesamtrate: monthlyRate,
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

  console.log('[buildQuotePayload] calcData snapshot:', {
    finance_type: input.calcData?.finance_type,
    term_months: input.calcData?.term_months,
    leasing_factor: input.calcData?.leasing_factor,
    margin_total: input.calcData?.margin_total,
    total_monthly_rate: input.calcData?.total_monthly_rate,
    service_rate: input.calcData?.service_rate,
    total_hardware_ek: input.calcData?.total_hardware_ek,
  });
  console.log('[buildQuotePayload] Leasingfaktor sent:', payload.Leasingfaktor,
              'Gesamtrate:', payload.Gesamtrate);

  return payload;
}

/**
 * Build payload for a record in the Zoho custom module Vertr_ge (Verträge).
 *
 * Field-API-Namen aus der Org bestätigt (Display → API):
 *   Vertragsnummer → Name (Pflicht), Firmierung → Kundenname,
 *   Account (Lookup), Vertragsart, Finanzprodukt, Vertragsbeginn,
 *   Grundlaufzeitende, Grundlaufzeit (Monate), Leasingfaktor,
 *   Gesamtrate_monatl, Leasingrate_monatl, Wartungsrate_monatl,
 *   Warennettowert.
 *
 * Undefined-Felder werden vor dem Senden entfernt.
 */
export interface BuildVertragPayloadInput {
  /** Pflicht: Inhalt für das Vertragsnummer-Feld (`Name`). */
  vertragsnummer: string;
  /** Firmierung des Kunden (Display) → API `Kundenname`. */
  kundenname?: string;
  /** Zoho-Account-ID für den `Account`-Lookup. */
  accountId?: string;
  /** Vertragsart (Auswahlliste, z. B. "Leasing"). */
  vertragsart?: string | null;
  /** Finanzprodukt (Auswahlliste). */
  finanzprodukt?: string | null;
  /** Grundlaufzeit in Monaten. */
  grundlaufzeit?: number | null;
  /** Monatliche Gesamtrate (Währung). */
  gesamtrateMonatl?: number | null;
  /** Leasingfaktor (Dezimalstelle). */
  leasingfaktor?: number | null;
  /** Monatliche Wartungsrate (Währung). */
  wartungsrateMonatl?: number | null;
  /** Monatliche Leasingrate (Währung). */
  leasingrateMonatl?: number | null;
  /** Warennettowert (Währung). */
  warennettowert?: number | null;
  /** Vertragsbeginn (ISO-Datum YYYY-MM-DD). */
  vertragsbeginn?: string | null;
  /** Grundlaufzeitende (ISO-Datum). */
  grundlaufzeitende?: string | null;
}

interface SalesOrderUpdateInput {
  subject?: string | null;
  /** Lokales finance_type ('leasing'|'eigenmiete'|'kauf_wartung'|'allin'). */
  financeType?: string | null;
  /** Vertragsart-Picklist (z. B. 'Leasing', 'All-In'). Wenn nicht gesetzt,
   *  leiten wir den Wert aus financeType über das Quote-Mapping ab. */
  contractType?: string | null;
  termMonths?: number | null;
  rate?: number | null;
  factor?: number | null;
  maintenanceShare?: number | null;
  leasingShare?: number | null;
  goodsValue?: number | null;
  contractStart?: string | null;
}

/**
 * Mapping order_processing → Sales_Orders Custom-Fields.
 *
 * Sales_Orders trägt im Convert-Schritt die Quote-Werte; nach der
 * Nachkalkulation in der Abwicklung schreiben wir die aktualisierten
 * Werte mit den gleichen API-Namen wie im Quote-Builder zurück, damit
 * die SO als Print-Vorlage konsistent bleibt.
 *
 * Felder ohne Wert werden vor dem Senden entfernt — Zoho lehnt unbekannte
 * Custom-Field-Namen mit INVALID_DATA ab und nennt den problematischen
 * Key, dann passen wir das Mapping gezielt nach.
 */
export function buildSalesOrderUpdatePayload(input: SalesOrderUpdateInput): Record<string, any> {
  const ft = input.financeType?.toLowerCase();
  const rateFields: Record<string, number> = {};
  if (input.rate !== null && input.rate !== undefined && ft) {
    if (ft === 'leasing') rateFields.Leasingrate = input.rate;
    else if (ft === 'eigenmiete' || ft === 'miete') rateFields.Mietrate = input.rate;
    else if (ft === 'allin' || ft === 'all_in' || ft === 'all-in') rateFields.All_In_Rate = input.rate;
  }

  const payload: Record<string, any> = {
    Subject: input.subject || undefined,
    Auswahlliste_1: ft
      ? FINANCE_TYPE_TO_PICKLIST[ft] || input.financeType || undefined
      : undefined,
    Vertragsart: input.contractType || undefined,
    Vertragsbeginn: input.contractStart || undefined,
    Vertragslaufzeit: input.termMonths !== null && input.termMonths !== undefined
      ? `${input.termMonths} Monate`
      : undefined,
    Laufzeit_Vertrag: input.termMonths ?? undefined,
    Anzahl_Monate: input.termMonths ?? undefined,
    Leasingfaktor: input.factor ?? undefined,
    Leasinganteil: input.leasingShare ?? undefined,
    Wartungsanteil: input.maintenanceShare ?? undefined,
    Summe_UHG: input.goodsValue ?? undefined,
    Gesamtrate: input.rate ?? undefined,
    ...rateFields,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

export function buildVertragPayload(input: BuildVertragPayloadInput): Record<string, any> {
  const payload: Record<string, any> = {
    Name: input.vertragsnummer,
    Kundenname: input.kundenname || undefined,
    Account: input.accountId ? { id: input.accountId } : undefined,
    Vertragsart: input.vertragsart || undefined,
    Finanzprodukt: input.finanzprodukt || undefined,
    Grundlaufzeit: input.grundlaufzeit ?? undefined,
    Gesamtrate_monatl: input.gesamtrateMonatl ?? undefined,
    Leasingfaktor: input.leasingfaktor ?? undefined,
    Wartungsrate_monatl: input.wartungsrateMonatl ?? undefined,
    Leasingrate_monatl: input.leasingrateMonatl ?? undefined,
    Warennettowert: input.warennettowert ?? undefined,
    Vertragsbeginn: input.vertragsbeginn || undefined,
    Grundlaufzeitende: input.grundlaufzeitende || undefined,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

interface DraftQuoteInput {
  projectName: string;
  layoutId: string;
  dealId?: string;
  contactZohoId?: string;
  accountZohoId?: string;
  validity?: number;
}

/**
 * Minimaler Quote-Payload zum **initialen** Anlegen einer Draft-Quote
 * direkt nach Projekt-Anlage. Keine Quoted_Items (kommen später beim
 * "Speichern aus Vorschau"). Genug Felder, dass Zoho eine Quote_Number
 * vergeben kann und Deal/Account verknüpft sind.
 */
export function buildDraftQuotePayload(input: DraftQuoteInput): Record<string, any> {
  const payload: Record<string, any> = {
    Subject: input.projectName?.trim() || `Angebot ${new Date().toLocaleDateString('de-DE')}`,
    Quote_Stage: 'In Arbeit',
    Layout: { id: input.layoutId },
    Valid_Till: new Date(Date.now() + (input.validity ?? 30) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    Deal_Name: input.dealId ? { id: input.dealId } : undefined,
    Contact_Name: input.contactZohoId ? { id: input.contactZohoId } : undefined,
    Account_Name: input.accountZohoId ? { id: input.accountZohoId } : undefined,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

export { QUOTE_INVENTORY_TEMPLATE_ID, zohoClient };
