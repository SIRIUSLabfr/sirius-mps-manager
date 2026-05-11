/**
 * Picklist-Werte für die Vertragsdaten in der Abwicklung.
 *
 * Diese Listen müssen mit den Auswahllisten im Zoho-Custom-Modul
 * `Vertr_ge` übereinstimmen, sonst lehnt Zoho beim „Vertrag in Zoho
 * anlegen" einzelne Werte mit INVALID_DATA ab. Bei Erweiterung der
 * Picklists in Zoho hier mit nachziehen.
 */

export const VERTRAGSART_OPTIONS = [
  'Leasing',
  'Eigenmiete',
  'Kauf + Wartungsvertrag',
  'All-In',
] as const;

export const LEASINGGEBER_OPTIONS = [
  'Grenke',
  'GEFA',
  'Deutsche Leasing',
  'Albis',
  'DLL',
  'BNP Paribas',
  'abcfinance',
  'Sonstige',
] as const;

export const ZAHLUNGSWEISE_OPTIONS = ['monatlich', 'quartalsweise'] as const;

/**
 * Mapping local `finance_type` (calc) → `contract_type` (order_processing /
 * Vertragsart-Picklist). Beim „Auftrag erteilt"-Flow wird der lokale Wert
 * über dieses Mapping auf den Picklist-Label normalisiert.
 */
export const FINANCE_TYPE_TO_VERTRAGSART: Record<string, string> = {
  leasing: 'Leasing',
  eigenmiete: 'Eigenmiete',
  miete: 'Eigenmiete',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  kauf_wv: 'Kauf + Wartungsvertrag',
  allin: 'All-In',
  all_in: 'All-In',
};

export function normalizeVertragsart(financeType?: string | null): string | undefined {
  if (!financeType) return undefined;
  return FINANCE_TYPE_TO_VERTRAGSART[financeType.toLowerCase()] || financeType;
}
