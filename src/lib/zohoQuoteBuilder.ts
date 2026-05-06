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
  const mixServiceItems: any[] = cfg.mix_service_items || cfg.service?.items || [];

  // ---- Line items: every line MUST have a Zoho product reference ----
  const productDetails: any[] = [];

  groups.forEach((g: any, idx: number) => {
    const main = g.mainDevice || null;
    const productId = main?.id && !String(main.id).startsWith('manual-') ? main.id : g.zoho_product_id;
    if (!productId) return; // Zoho rejects product details without product id

    const qty = g.mainQuantity || g.quantity || 1;
    const unitPrice = main?.price ?? g.priceVk ?? g.vk ?? g.priceEk ?? g.ek ?? 0;
    const productName =
      main?.name || `${g.manufacturer || ''} ${g.model || ''}`.trim() || `Gerät ${idx + 1}`;

    productDetails.push({
      product: { id: productId, name: productName },
      product_name: productName,
      quantity: qty,
      list_price: unitPrice,
      Discount: 0,
      Tax: 0,
    });

    // Accessories (each may have its own zoho product)
    (g.accessories || []).forEach((acc: any) => {
      const accId = acc?.id && !String(acc.id).startsWith('manual-') ? acc.id : null;
      if (!accId) return;
      productDetails.push({
        product: { id: accId, name: acc.name },
        product_name: acc.name,
        quantity: acc.quantity || qty,
        list_price: acc.price || 0,
        Discount: 0,
        Tax: 0,
      });
    });
  });

  // Mischkalkulation service items as additional line items (only if linked to Zoho product)
  mixServiceItems.forEach((it: any) => {
    const p = it.product;
    if (!p?.id || String(p.id).startsWith('manual-')) return;
    productDetails.push({
      product: { id: p.id, name: p.name },
      product_name: p.name,
      quantity: it.quantity || 1,
      list_price: p.price || 0,
      Discount: 0,
      Tax: 0,
    });
  });

  // ---- Quote payload (only safe-default fields) ----
  const payload: Record<string, any> = {
    Subject: input.projectName || 'Angebot',
    Valid_Till: input.validity
      ? new Date(Date.now() + input.validity * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined,
    Deal_Name: input.dealId ? { id: input.dealId } : undefined,
    Contact_Name: input.contactZohoId ? { id: input.contactZohoId } : undefined,
    Account_Name: input.accountZohoId ? { id: input.accountZohoId } : undefined,
    Product_Details: productDetails,
    Description: [
      `Vertragsart: ${input.calcData?.finance_type || '–'}`,
      `Laufzeit: ${input.calcData?.term_months || '–'} Monate`,
      `Leasingfaktor: ${input.calcData?.leasing_factor || '–'}`,
      `Marge: ${input.calcData?.margin_total || '–'}`,
      `Monatliche Gesamtrate: ${input.calcData?.total_monthly_rate || 0} €`,
      `Service-Pauschale: ${input.calcData?.service_rate || 0} €`,
      `S/W-Volumen: ${calc.total_volume_bw || 0} Seiten/Monat`,
      `Farb-Volumen: ${calc.total_volume_color || 0} Seiten/Monat`,
      `Folgeseiten S/W: ${calc.folgeseitenpreis_sw || cfg.folgeseitenpreis_sw || 0} €`,
      `Folgeseiten Farbe: ${calc.folgeseitenpreis_farbe || cfg.folgeseitenpreis_farbe || 0} €`,
      input.zusatz?.mietfreie_startphase ? `Mietfreie Startphase: ${input.zusatz.mietfreie_startphase}` : '',
      input.zusatz?.berechnungsintervall ? `Berechnungsintervall: ${input.zusatz.berechnungsintervall}` : '',
    ].filter(Boolean).join('\n'),
  };

  // Strip undefined values
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  return payload;
}

export { QUOTE_INVENTORY_TEMPLATE_ID, zohoClient };
