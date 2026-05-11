/**
 * Zoho CRM API client – communicates via Netlify serverless functions.
 * Tokens are stored in HttpOnly cookies (managed by the functions).
 */

export const QUOTE_INVENTORY_TEMPLATE_ID = '842083000013892883';
export const QUOTE_LAYOUT_NAME = 'Standard';

/**
 * API-Name des Custom-Felds am Zoho-Account, das die Kundennummer hält.
 * Falls in der Org anders benannt, hier anpassen — wir lesen mit Fallback
 * auf das Standard-Feld `Account_Number`.
 */
export const ZOHO_ACCOUNT_CUSTOMER_NUMBER_FIELD = 'Kundennummer';

/**
 * API-Name des Custom-Felds am Zoho-Quote-Modul für die Angebots-Nummer
 * (im Inventory-Template als ${Angebote.Angebotsnr.} referenziert).
 * Fallback ist `Quote_Number` (Standard-Feld), falls dieses Custom-Feld
 * nicht existiert oder leer ist.
 */
export const ZOHO_QUOTE_OFFER_NUMBER_FIELD = 'Angebotsnr';

/**
 * API-Name des Zoho-Custom-Moduls für Verträge. Zoho ersetzt Umlaute
 * standardmäßig durch Underscore — "Verträge" → "Vertr_ge".
 */
export const ZOHO_CONTRACT_MODULE = 'Vertr_ge';

let _quoteLayoutIdCache: string | null = null;

// IDs the user has just created/updated. Validation hooks must NOT clear
// these for a short grace period, otherwise a freshly created record can
// be wrongly judged "missing" before Zoho's read pipeline catches up.
//
// Persisted in sessionStorage so module reloads / HMR / focus events
// across tabs don't lose the marker.
const FRESH_TTL_MS = 10 * 60 * 1000;
const FRESH_STORAGE_KEY = 'zoho:fresh-ids';

function _loadFresh(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(FRESH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function _saveFresh(map: Record<string, number>) {
  try { sessionStorage.setItem(FRESH_STORAGE_KEY, JSON.stringify(map)); } catch {}
}

export function markZohoIdFresh(id: string | null | undefined) {
  if (!id) return;
  const map = _loadFresh();
  map[String(id)] = Date.now() + FRESH_TTL_MS;
  _saveFresh(map);
  console.log('[zoho] markFresh', id, 'expires', new Date(map[String(id)]).toISOString());
}

export function isZohoIdFresh(id: string | null | undefined): boolean {
  if (!id) return false;
  const map = _loadFresh();
  const exp = map[String(id)];
  if (!exp) return false;
  if (Date.now() > exp) {
    delete map[String(id)];
    _saveFresh(map);
    return false;
  }
  return true;
}

export const zohoClient = {
  login: () => {
    window.location.href = '/.netlify/functions/zoho-auth';
  },

  api: async (endpoint: string, method: string = 'GET', data?: any, api: string = 'crm', opts?: { throwOnError?: boolean }): Promise<any | null> => {
    if (method !== 'GET' && data) {
      console.log('[Zoho →]', endpoint, JSON.stringify(data, null, 2));
    }
    const response = await fetch('/.netlify/functions/zoho-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint, method, data, api }),
    }).catch((e) => {
      console.warn('Zoho network error:', e);
      if (opts?.throwOnError) throw e;
      return null as any;
    });
    if (!response) return null;

    if (response.status === 401) {
      if (opts?.throwOnError) throw new Error('Zoho 401: nicht authentifiziert. Bitte erneut mit Zoho verbinden.');
      return null;
    }

    const json = await response.json().catch(() => ({}));

    const formatErr = (item: any, fallback: string) => {
      const msg = item?.message || fallback;
      let detailStr = '';
      if (item?.details) {
        try {
          detailStr = typeof item.details === 'string'
            ? item.details
            : JSON.stringify(item.details);
        } catch { detailStr = String(item.details); }
      }
      return detailStr ? `${msg} – ${detailStr}` : msg;
    };

    if (!response.ok) {
      const item = json?.data?.[0] || json || {};
      const full = formatErr(item, json?.message || json?.error || `HTTP ${response.status}`);
      console.error('Zoho API error', { endpoint, method, status: response.status, json });
      if (opts?.throwOnError) throw new Error(`Zoho ${response.status}: ${full}`);
      return null;
    }

    // Zoho often returns 200 with per-record errors
    if (json?.data?.[0]?.code && json.data[0].code !== 'SUCCESS') {
      const item = json.data[0];
      const full = formatErr(item, item.code);
      console.error('Zoho API record error', { endpoint, method, json });
      if (opts?.throwOnError) throw new Error(`Zoho: ${full}`);
      return null;
    }

    return json;
  },



  /**
   * Download a binary asset (PDF) from Zoho.
   * Supports GET and POST – v7 print endpoints typically expect POST
   * with a JSON body containing the template id.
   */
  apiBinary: async (
    endpoint: string,
    api: string = 'crm',
    opts?: { method?: 'GET' | 'POST'; data?: any; extraHeaders?: Record<string, string> },
  ): Promise<Blob | null> => {
    const response = await fetch('/.netlify/functions/zoho-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint,
        method: opts?.method || 'GET',
        data: opts?.data,
        api,
        responseType: 'binary',
        extraHeaders: opts?.extraHeaders,
      }),
    });
    const json = await response.json().catch(() => null);
    if (json?.__binaryError) {
      console.error('[Zoho binary error]', json);
      const detail = typeof json.body === 'string' ? json.body : JSON.stringify(json.body)?.slice(0, 400);
      throw new Error(`Zoho ${json.status} (${json.contentType || 'unknown'}): ${detail}`);
    }
    if (!response.ok || !json?.__binary) {
      console.warn('[Zoho binary] unexpected response', { status: response.status, json });
      return null;
    }
    const byteChars = atob(json.base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    console.log('[Zoho PDF] received', bytes.length, 'bytes,', json.contentType);
    return new Blob([bytes], { type: json.contentType || 'application/pdf' });
  },

  /** Upload a file (multipart) to a Zoho record (e.g. Quote attachment) */
  uploadAttachment: async (endpoint: string, file: Blob, fileName: string): Promise<any | null> => {
    try {
      const fd = new FormData();
      fd.append('endpoint', endpoint);
      fd.append('api', 'crm');
      fd.append('file', file, fileName);
      const response = await fetch('/.netlify/functions/zoho-api', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      return await response.json();
    } catch (e) {
      console.warn('Zoho upload error:', e);
      return null;
    }
  },

  getDeal: async (dealId: string) => {
    return zohoClient.api(`Deals/${dealId}`);
  },

  getAccount: async (accountId: string) => {
    return zohoClient.api(`Accounts/${accountId}`);
  },

  /**
   * Create a record in the custom Vertr_ge (Verträge) module.
   * Field-Mapping siehe buildVertragPayload — unbekannte Felder lehnt
   * Zoho mit INVALID_DATA ab, der Fehler nennt den problematischen Key.
   */
  createContract: async (payload: Record<string, any>) => {
    return zohoClient.api(
      `${ZOHO_CONTRACT_MODULE}`,
      'POST',
      { data: [payload] },
      'crm',
      { throwOnError: true },
    );
  },

  /**
   * Check whether a CRM record still exists (not deleted / recycled).
   *
   * Uses GET /{module}/{id}?fields=id,Record_Status__s — a direct primary-
   * key lookup with no search-index delay. The fields param ensures Zoho
   * returns Record_Status__s so we can distinguish "Available" from
   * recycled records.
   *
   * Returns:
   *   true  – record found and Record_Status__s is Available (or absent)
   *   false – record gone (deleted / recycled / never existed)
   *   null  – network or auth issue, caller should not act on this
   */
  recordExists: async (module: string, id: string): Promise<boolean | null> => {
    if (!/^\d{6,}$/.test(id)) return false; // garbage / non-Zoho id
    try {
      const response = await fetch('/.netlify/functions/zoho-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: `${module}/${id}`,
          method: 'GET',
          api: 'crm',
        }),
      });
      if (response.status === 401) return null;
      const json = await response.json().catch(() => ({}));
      // Proxy maps Zoho 204 (empty) to { __empty: true } with HTTP 200.
      if (json?.__empty) {
        console.log('[zoho recordExists]', module, id, 'EMPTY -> gone');
        return false;
      }
      if (!response.ok) {
        const code = json?.code || json?.data?.[0]?.code;
        console.log('[zoho recordExists]', module, id, 'HTTP', response.status, 'code', code);
        if (code === 'INVALID_DATA' || code === 'NO_DATA') return false;
        return null;
      }
      const rec = json?.data?.[0];
      if (!rec) {
        console.log('[zoho recordExists]', module, id, 'no data[0]');
        return false;
      }
      if (rec.Record_Status__s && rec.Record_Status__s !== 'Available') {
        console.log('[zoho recordExists]', module, id, 'Record_Status__s', rec.Record_Status__s);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[Zoho recordExists] network error', e);
      return null;
    }
  },

  searchProducts: async (query: string) => {
    return zohoClient.api(`Products/search?word=${encodeURIComponent(query)}`);
  },

  searchContacts: async (query: string) => {
    return zohoClient.api(`Contacts/search?word=${encodeURIComponent(query)}`);
  },

  /**
   * Sucht Kontakte mit Namens-Match, gefiltert auf einen Account.
   * Nutzt Zohos `criteria`-Syntax: First_Name oder Last_Name beginnt
   * mit dem Query, AND Account_Name.id == accountId.
   */
  searchContactsByAccount: async (accountId: string, query: string) => {
    const q = query.trim();
    if (!accountId || q.length < 1) return null;
    const criteria = `((Account_Name.id:equals:${accountId})and((Last_Name:starts_with:${q})or(First_Name:starts_with:${q})))`;
    return zohoClient.api(`Contacts/search?criteria=${encodeURIComponent(criteria)}`);
  },

  updateDeal: async (dealId: string, fields: Record<string, any>) => {
    return zohoClient.api('Deals', 'PUT', {
      data: [{ id: dealId, ...fields }],
    });
  },

  getCurrentUser: async () => {
    const result = await zohoClient.api('users?type=CurrentUser');
    return result?.users?.[0] || null;
  },

  getAllUsers: async () => {
    const dirResult = await zohoClient.api('Users?count=200', 'GET', undefined, 'directory');
    if (dirResult?.Resources?.length) {
      return dirResult.Resources.map((u: any) => ({
        id: u.id,
        email: u.emails?.find((e: any) => e.primary)?.value || u.userName || '',
        full_name: u.displayName || `${u.name?.givenName || ''} ${u.name?.familyName || ''}`.trim(),
        first_name: u.name?.givenName || '',
        last_name: u.name?.familyName || '',
        role: { name: u.roles?.[0]?.value || '' },
        status: u.active ? 'active' : 'inactive',
        _source: 'directory',
      }));
    }
    const result = await zohoClient.api('users?type=AllUsers');
    return (result?.users || []).map((u: any) => ({ ...u, _source: 'crm' }));
  },

  // ==================== LAYOUTS ====================

  /** List layouts for a module (e.g. Quotes). */
  getLayouts: async (module: string) => {
    return zohoClient.api(`settings/layouts?module=${encodeURIComponent(module)}`);
  },

  /**
   * Resolve a Layout ID by name (e.g. "Standard") for the Quotes module.
   * Result is cached for the session.
   */
  getQuoteLayoutId: async (layoutName: string = QUOTE_LAYOUT_NAME): Promise<string | null> => {
    if (_quoteLayoutIdCache) return _quoteLayoutIdCache;
    const res = await zohoClient.getLayouts('Quotes');
    const layouts: any[] = res?.layouts || [];
    const match = layouts.find(l =>
      l?.name === layoutName || l?.display_label === layoutName || l?.api_name === layoutName,
    );
    _quoteLayoutIdCache = match?.id || null;
    return _quoteLayoutIdCache;
  },

  // ==================== QUOTES ====================

  /** Create a Zoho CRM Quote. Pass full payload (will be wrapped in {data:[]}). */
  createQuote: async (quote: Record<string, any>) => {
    return zohoClient.api('Quotes', 'POST', { data: [quote] }, 'crm', { throwOnError: true });
  },

  /** Update an existing Quote. */
  updateQuote: async (quoteId: string, fields: Record<string, any>) => {
    return zohoClient.api('Quotes', 'PUT', { data: [{ id: quoteId, ...fields }] }, 'crm', { throwOnError: true });
  },

  /** Get a Quote record */
  getQuote: async (quoteId: string) => {
    return zohoClient.api(`Quotes/${quoteId}`);
  },

  /**
   * Update a Quote *replacing* the line items rather than appending.
   *
   * Zoho v7 PUT with Quoted_Items APPENDS by default; to replace, the
   * caller must mark each existing row with `_delete: true` AND append
   * the new rows. This helper fetches the current rows (explicitly
   * requesting the subform field so it's never missing), builds the
   * delete-markers, then sends a single PUT.
   *
   * If the GET returns no items but the layout has them, we still send
   * the new items without delete markers - that yields the old append
   * behaviour, which is at least no worse than the previous flow.
   */
  updateQuoteReplaceItems: async (quoteId: string, fields: Record<string, any>) => {
    const newItems: any[] = Array.isArray(fields.Quoted_Items) ? fields.Quoted_Items : [];

    // Explicitly request the subform field. Some Zoho v7 layouts
    // omit subforms from the default GET response.
    const current = await zohoClient.api(`Quotes/${quoteId}?fields=Quoted_Items`);
    const existing: any[] = current?.data?.[0]?.Quoted_Items || [];
    console.log('[zoho updateQuoteReplaceItems] GET Quoted_Items returned', existing.length, 'rows');
    if (existing.length === 0) {
      // Fallback: pull whole record once more without fields filter
      const fullCurrent = await zohoClient.api(`Quotes/${quoteId}`);
      const fullExisting: any[] = fullCurrent?.data?.[0]?.Quoted_Items || [];
      console.log('[zoho updateQuoteReplaceItems] full GET returned', fullExisting.length, 'rows');
      existing.push(...fullExisting);
    }

    const deleteMarkers = existing
      .map((row: any) => row?.id ? { id: String(row.id), _delete: true } : null)
      .filter(Boolean);

    const merged = [...deleteMarkers, ...newItems];
    const payload = { ...fields, Quoted_Items: merged };

    console.log('[zoho updateQuoteReplaceItems]', quoteId, 'delete', deleteMarkers.length, 'add', newItems.length);
    return zohoClient.api('Quotes', 'PUT', { data: [{ id: quoteId, ...payload }] }, 'crm', { throwOnError: true });
  },

  /**
   * Generate a PDF of the Quote using the given Inventory template.
   * Tries multiple endpoint variants because Zoho's v7 print API has
   * inconsistent shapes across modules / regions:
   *   1) GET  /Quotes/{id}/download_inventory_template?inventory_template_id=...
   *   2) GET  /Quotes/{id}/actions/print?inventory_template_id=...
   *   3) POST /Quotes/{id}/actions/print  body { data:[{inventory_template_id}] }
   * The first variant that returns a real PDF blob (>1 KB,
   * content-type application/pdf) wins. JSON {} responses (the failure
   * mode the user observed) are treated as miss and the next variant
   * is attempted.
   */
  /**
   * List inventory templates available for a module. Useful for diagnosing
   * "PDF returns {}" – usually means the configured template id doesn't
   * actually exist in the org or isn't bound to this module.
   */
  listInventoryTemplates: async (module: string = 'Quotes') => {
    return zohoClient.api(`settings/inventory_templates?module=${encodeURIComponent(module)}`);
  },

  getQuotePdf: async (quoteId: string, templateId: string = QUOTE_INVENTORY_TEMPLATE_ID): Promise<Blob | null> => {
    // Up to now ALL GET variants of /actions/print returned HTTP 200 with
    // body "{}" (zero PDF bytes). The endpoint exists but the template
    // binding clearly isn't working. Two suspected root causes:
    //   a) Zoho only emits the PDF when the Accept: application/pdf header
    //      is set – without it, content negotiation may fall back to JSON.
    //   b) The configured templateId isn't actually a valid inventory
    //      template for the Quotes module in this org.
    // We log the available templates for diagnostics, then try a wider
    // grid of variants including Accept-header forms.
    try {
      const tpls = await zohoClient.listInventoryTemplates('Quotes');
      const list = tpls?.inventory_templates || tpls?.data || [];
      console.log('[Zoho PDF] available Quote inventory templates:',
        list.map((t: any) => ({ id: t.id, name: t.name, module: t.module })));
      const match = list.find((t: any) => String(t.id) === String(templateId));
      if (!match) {
        console.error(`[Zoho PDF] configured templateId ${templateId} NOT found in org's Quote inventory templates. Verify QUOTE_INVENTORY_TEMPLATE_ID against the list above.`);
      }
    } catch (e) {
      console.warn('[Zoho PDF] could not list templates', e);
    }

    const acceptPdf = { Accept: 'application/pdf' };
    const variants: Array<{ label: string; endpoint: string; opts?: any }> = [
      { label: 'GET actions/print ?inventory_template_id + Accept:pdf',
        endpoint: `Quotes/${quoteId}/actions/print?inventory_template_id=${templateId}`,
        opts: { extraHeaders: acceptPdf } },
      { label: 'GET actions/download_pdf ?inventory_template_id',
        endpoint: `Quotes/${quoteId}/actions/download_pdf?inventory_template_id=${templateId}`,
        opts: { extraHeaders: acceptPdf } },
      { label: 'GET ?inventory_template_id (no /actions/) + Accept:pdf',
        endpoint: `Quotes/${quoteId}?inventory_template_id=${templateId}`,
        opts: { extraHeaders: acceptPdf } },
      { label: 'GET actions/print ?inventory_template (no _id) + Accept:pdf',
        endpoint: `Quotes/${quoteId}/actions/print?inventory_template=${templateId}`,
        opts: { extraHeaders: acceptPdf } },
      { label: 'GET actions/print ?inventory_template_id + Accept */*',
        endpoint: `Quotes/${quoteId}/actions/print?inventory_template_id=${templateId}`,
        opts: { extraHeaders: { Accept: '*/*' } } },
      { label: 'GET actions/print + header inventory_template + Accept:pdf',
        endpoint: `Quotes/${quoteId}/actions/print`,
        opts: { extraHeaders: { ...acceptPdf, 'inventory_template': templateId } } },
    ];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      try {
        const blob = await zohoClient.apiBinary(v.endpoint, 'crm', v.opts);
        if (blob && blob.size > 1024 && blob.type.includes('pdf')) {
          console.log(`[Zoho PDF] variant ${i + 1} (${v.label}) succeeded:`, blob.size, 'bytes');
          return blob;
        }
        console.warn(`[Zoho PDF] variant ${i + 1} (${v.label}) no PDF:`, blob?.size, blob?.type);
      } catch (e: any) {
        console.warn(`[Zoho PDF] variant ${i + 1} (${v.label}) failed:`, e?.message || e);
      }
    }
    return null;
  },

  /** Upload an attachment file to a Quote */
  attachToQuote: async (quoteId: string, file: Blob, fileName: string) => {
    return zohoClient.uploadAttachment(`Quotes/${quoteId}/Attachments`, file, fileName);
  },

  /** Download a specific attachment from a Quote as a Blob. */
  downloadQuoteAttachment: async (quoteId: string, attachmentId: string): Promise<Blob | null> => {
    return zohoClient.apiBinary(`Quotes/${quoteId}/Attachments/${attachmentId}`);
  },

  /**
   * List attachments on a Quote. Zoho v7 lehnt sort_by auf Related-Lists
   * mit 400 ab; wir holen nur die per_page-Default-Liste und sortieren
   * clientseitig nach Created_Time desc.
   */
  listQuoteAttachments: async (quoteId: string) => {
    const res = await zohoClient.api(`Quotes/${quoteId}/Attachments?per_page=200`);
    const data: any[] = res?.data || [];
    data.sort((a: any, b: any) => {
      const ta = a?.Created_Time ? new Date(a.Created_Time).getTime() : 0;
      const tb = b?.Created_Time ? new Date(b.Created_Time).getTime() : 0;
      return tb - ta;
    });
    return res ? { ...res, data } : null;
  },

  /**
   * Execute a Zoho CRM Standalone Function via OAuth.
   * Returns the parsed function output (the function's return string is
   * delivered under data[0].details.output, sometimes JSON-stringified).
   */
  executeFunction: async (functionName: string, args: Record<string, any>) => {
    return zohoClient.api(
      `functions/${functionName}/actions/execute?auth_type=oauth`,
      'POST',
      { arguments: args },
      'crm',
      { throwOnError: true },
    );
  },

  /** Upload an attachment file to a Deal */
  attachToDeal: async (dealId: string, file: Blob, fileName: string) => {
    return zohoClient.uploadAttachment(`Deals/${dealId}/Attachments`, file, fileName);
  },

  /**
   * Convert a Quote to a Sales Order (Zoho CRM convert action).
   * v7 erwartet eine leere Action-Konfiguration im Body — Zusatzfelder
   * wie `overwrite`/`notify_*` werden je nach Org abgelehnt.
   * v7 response shape: { data: [{ Sales_Order: "<id>" }] }
   */
  convertQuoteToSalesOrder: async (quoteId: string) => {
    const result = await zohoClient.api(
      `Quotes/${quoteId}/actions/convert`,
      'POST',
      { data: [{}] },
      'crm',
      { throwOnError: true }
    );
    const item = result?.data?.[0];
    if (item?.code && item.code !== 'SUCCESS') {
      throw new Error(`Zoho Convert: ${item.message || item.code}`);
    }
    return result;
  },

  /**
   * Extract the new Sales Order ID from a Quote-convert response.
   * Tolerates both v7 (Sales_Order: "<id>") and older shapes.
   */
  extractSalesOrderId: (conv: any): string | null => {
    const item = conv?.data?.[0];
    if (!item) return null;
    if (typeof item.Sales_Order === 'string') return item.Sales_Order;
    if (typeof item.SalesOrder === 'string') return item.SalesOrder;
    return item.details?.Sales_Order?.id
      || item.details?.SalesOrder?.id
      || item.details?.id
      || null;
  },
};
