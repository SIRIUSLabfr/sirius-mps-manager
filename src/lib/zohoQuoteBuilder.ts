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
}

/**
 * Build a Zoho CRM Quote payload from the local calculation.
 * Includes line items (Product_Details), service block, and custom fields.
 */
export function buildQuotePayload(input: BuildQuotePayloadInput): Record<string, any> {
  const cfg = input.calcData?.config_json || {};
  const groups = cfg.device_groups || cfg.deviceGroups || [];
  const calc = cfg.calculated || {};

  // ---- Line items: one per device group ----
  const productDetails: any[] = [];

  groups.forEach((g: any, idx: number) => {
    const qty = g.mainQuantity || g.quantity || 1;
    const unitPrice = g.priceVk || g.vk || g.priceEk || g.ek || 0;
    const productName = `${g.manufacturer || ''} ${g.model || ''}`.trim() || `Gerät ${idx + 1}`;

    productDetails.push({
      product: g.zoho_product_id ? { id: g.zoho_product_id } : undefined,
      product_name: productName,
      quantity: qty,
      list_price: unitPrice,
      Discount: 0,
      Tax: 0,
      product_description: [g.options, g.accessories].filter(Boolean).join(' · ') || undefined,
    });
  });

  // ---- Service / Leasing block as separate lines ----
  if (input.calcData?.service_rate) {
    productDetails.push({
      product_name: 'Service-Pauschale (monatlich)',
      quantity: 1,
      list_price: input.calcData.service_rate,
      Discount: 0,
      Tax: 0,
    });
  }

  if (input.calcData?.total_monthly_rate) {
    productDetails.push({
      product_name: `Monatliche Gesamtrate (${input.calcData.term_months || 60} Monate)`,
      quantity: 1,
      list_price: input.calcData.total_monthly_rate,
      Discount: 0,
      Tax: 0,
    });
  }

  // ---- Quote payload ----
  const payload: Record<string, any> = {
    Subject: input.projectName || 'Angebot',
    Quote_Stage: 'Draft',
    Valid_Till: input.validity
      ? new Date(Date.now() + input.validity * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined,
    Deal_Name: input.dealId ? { id: input.dealId } : undefined,
    Contact_Name: input.contactZohoId ? { id: input.contactZohoId } : undefined,
    Account_Name: input.accountZohoId ? { id: input.accountZohoId } : undefined,
    Product_Details: productDetails,
    Sub_Total: calc.total_hardware_ek || input.calcData?.total_hardware_ek || 0,
    Grand_Total: input.calcData?.total_monthly_rate || 0,
    // Custom fields (snake_cf_*) – names depend on Zoho org config; Zoho ignores unknown fields
    Description: [
      `Vertragsart: ${input.calcData?.finance_type || '–'}`,
      `Laufzeit: ${input.calcData?.term_months || '–'} Monate`,
      `Leasingfaktor: ${input.calcData?.leasing_factor || '–'}`,
      `Marge: ${input.calcData?.margin_total || '–'}`,
      `S/W-Volumen: ${calc.total_volume_bw || 0} Seiten/Monat`,
      `Farb-Volumen: ${calc.total_volume_color || 0} Seiten/Monat`,
      `Folgeseiten S/W: ${calc.folgeseitenpreis_sw || 0} €`,
      `Folgeseiten Farbe: ${calc.folgeseitenpreis_farbe || 0} €`,
      input.zusatz?.mietfreie_startphase ? `Mietfreie Startphase: ${input.zusatz.mietfreie_startphase}` : '',
      input.zusatz?.berechnungsintervall ? `Berechnungsintervall: ${input.zusatz.berechnungsintervall}` : '',
    ].filter(Boolean).join('\n'),
  };

  // Strip undefined values
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  return payload;
}

export { QUOTE_INVENTORY_TEMPLATE_ID, zohoClient };
