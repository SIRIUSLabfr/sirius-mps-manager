/**
 * Zoho CRM API client – communicates via Netlify serverless functions.
 * Tokens are stored in HttpOnly cookies (managed by the functions).
 */

export const QUOTE_INVENTORY_TEMPLATE_ID = '842083000013892883';
export const QUOTE_LAYOUT_NAME = 'Standard';

let _quoteLayoutIdCache: string | null = null;

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



  /** Download a binary asset (PDF) from Zoho */
  apiBinary: async (endpoint: string, api: string = 'crm'): Promise<Blob | null> => {
    try {
      const response = await fetch('/.netlify/functions/zoho-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint, method: 'GET', api, responseType: 'binary' }),
      });
      if (!response.ok) return null;
      const json = await response.json();
      if (!json?.__binary) return null;
      const byteChars = atob(json.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      return new Blob([bytes], { type: json.contentType || 'application/pdf' });
    } catch (e) {
      console.warn('Zoho binary fetch error:', e);
      return null;
    }
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

  /**
   * Check whether a CRM record still exists (not deleted / recycled).
   * Uses the Search API: a record present in Zoho's recycle bin or hard
   * deleted will not show up in search results, so an empty result is a
   * reliable "no longer exists" signal.
   *
   * Returns:
   *   true  – record found and accessible
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
          endpoint: `${module}/search?criteria=(id:equals:${id})`,
          method: 'GET',
          api: 'crm',
        }),
      });
      if (response.status === 401) return null;
      const json = await response.json().catch(() => ({}));
      // Proxy maps Zoho 204 (empty) to { __empty: true } with HTTP 200.
      if (json?.__empty) return false;
      if (!response.ok) {
        // INVALID_DATA on a deleted/unknown id is also "gone".
        const code = json?.code || json?.data?.[0]?.code;
        if (code === 'INVALID_DATA' || code === 'NO_DATA') return false;
        return null;
      }
      const rec = json?.data?.[0];
      if (!rec) return false;
      if (rec.Record_Status__s && rec.Record_Status__s !== 'Available') return false;
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
   * Generate a PDF of the Quote using the given Inventory template.
   * Returns a Blob (application/pdf).
   */
  getQuotePdf: async (quoteId: string, templateId: string = QUOTE_INVENTORY_TEMPLATE_ID): Promise<Blob | null> => {
    return zohoClient.apiBinary(
      `Quotes/${quoteId}/actions/print?inventory_template_id=${templateId}`
    );
  },

  /** Upload an attachment file to a Quote */
  attachToQuote: async (quoteId: string, file: Blob, fileName: string) => {
    return zohoClient.uploadAttachment(`Quotes/${quoteId}/Attachments`, file, fileName);
  },

  /** Upload an attachment file to a Deal */
  attachToDeal: async (dealId: string, file: Blob, fileName: string) => {
    return zohoClient.uploadAttachment(`Deals/${dealId}/Attachments`, file, fileName);
  },

  /**
   * Convert a Quote to a Sales Order (Zoho CRM convert action).
   * v7 response shape: { data: [{ Sales_Order: "<id>" }] }
   */
  convertQuoteToSalesOrder: async (quoteId: string) => {
    const result = await zohoClient.api(
      `Quotes/${quoteId}/actions/convert`,
      'POST',
      { data: [{ overwrite: true, notify_lead_owner: false, notify_new_entity_owner: false }] },
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
