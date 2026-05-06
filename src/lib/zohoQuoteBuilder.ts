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

  // ---- Quote payload ----
  const payload: Record<string, any> = {
    Subject: input.projectName?.trim() || `Angebot ${new Date().toLocaleDateString('de-DE')}`,
    Quote_Stage: 'In Arbeit',
    Valid_Till: input.validity
      ? new Date(Date.now() + input.validity * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined,
    Deal_Name: input.dealId ? { id: input.dealId } : undefined,
    Contact_Name: input.contactZohoId ? { id: input.contactZohoId } : undefined,
    Account_Name: input.accountZohoId ? { id: input.accountZohoId } : undefined,
    Quoted_Items: quotedItems,
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
      ...((input.zusatz?.items || [])
        .filter((it: any) => it.active && it.text?.trim())
        .map((it: any, i: number) => `\n${i + 1}. ${it.text}`)),
    ].filter(Boolean).join('\n'),
  };

  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  return payload;
}

export { QUOTE_INVENTORY_TEMPLATE_ID, zohoClient };
