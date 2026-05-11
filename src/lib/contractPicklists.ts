/**
 * Picklist-Werte für die Vertragsdaten in der Abwicklung.
 *
 * Diese Listen müssen mit den Auswahllisten im Zoho-Custom-Modul
 * `Vertr_ge` übereinstimmen, sonst lehnt Zoho beim „Vertrag in Zoho
 * anlegen" einzelne Werte mit INVALID_DATA ab. Bei Erweiterung der
 * Picklists in Zoho hier mit nachziehen.
 */

/**
 * Vertragsart = Vertragstyp (Master vs. Aufstockung). Wird vom
 * Sachbearbeiter in der Abwicklung gewählt; Default beim Erstanlegen
 * ist 'Mastervertrag'.
 */
export const VERTRAGSART_OPTIONS = ['Mastervertrag', 'Aufstockung'] as const;

/** Leasinggeber-Picklist im Vertr_ge-Modul. */
export const LEASINGGEBER_OPTIONS = [
  'Grenke',
  'Targo',
  'Mercator',
  'SIRIUS',
  'Sonstige',
] as const;

/** Zahlungsweise-Picklist im Vertr_ge-Modul. */
export const ZAHLUNGSWEISE_OPTIONS = ['monatlich', 'quartalsweise'] as const;

/**
 * Mapping local `finance_type` (calc) → `Finanzprodukt`-Picklist im
 * Vertr_ge-Modul. Beim „Auftrag erteilt"-Flow und beim Vertrag-Anlegen
 * wird der lokale Wert über dieses Mapping normalisiert.
 */
export const FINANCE_TYPE_TO_FINANZPRODUKT: Record<string, string> = {
  leasing: 'Leasing',
  eigenmiete: 'Eigenmiete',
  miete: 'Eigenmiete',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  kauf_wv: 'Kauf + Wartungsvertrag',
  allin: 'All-In',
  all_in: 'All-In',
};

export function normalizeFinanzprodukt(financeType?: string | null): string | undefined {
  if (!financeType) return undefined;
  return FINANCE_TYPE_TO_FINANZPRODUKT[financeType.toLowerCase()] || financeType;
}
