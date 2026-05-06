/**
 * Zoho CRM API client – communicates via Netlify serverless functions.
 * Tokens are stored in HttpOnly cookies (managed by the functions).
 */

export const QUOTE_INVENTORY_TEMPLATE_ID = '842083000013892883';

export const zohoClient = {
  login: () => {
    window.location.href = '/.netlify/functions/zoho-auth';
  },

  api: async (endpoint: string, method: string = 'GET', data?: any, api: string = 'crm', opts?: { throwOnError?: boolean }): Promise<any | null> => {
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

    if (!response.ok) {
      const item = json?.data?.[0] || {};
      const apiName = item?.details?.api_name || item?.details?.expected_data_type || '';
      const msg = item?.message || json?.message || json?.error || `HTTP ${response.status}`;
      const full = apiName ? `${msg} (Feld: ${apiName})` : msg;
      console.error('Zoho API error', { endpoint, method, status: response.status, json });
      if (opts?.throwOnError) throw new Error(`Zoho ${response.status}: ${full}`);
      return null;
    }

    // Zoho often returns 200 with per-record errors
    if (json?.data?.[0]?.code && json.data[0].code !== 'SUCCESS') {
      const item = json.data[0];
      const apiName = item?.details?.api_name || '';
      const msg = item?.message || item?.code;
      const full = apiName ? `${msg} (Feld: ${apiName})` : msg;
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
   * Returns the new Sales Order ID.
   */
  convertQuoteToSalesOrder: async (quoteId: string) => {
    const result = await zohoClient.api(
      `Quotes/${quoteId}/actions/convert`,
      'POST',
      { data: [{ overwrite: true, notify: false }] },
      'crm',
      { throwOnError: true }
    );
    const item = result?.data?.[0];
    if (item?.code && item.code !== 'SUCCESS') {
      throw new Error(`Zoho Convert: ${item.message || item.code}`);
    }
    return result;
  },
};
