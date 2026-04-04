/**
 * Zoho CRM API client – communicates via Netlify serverless functions.
 * Tokens are stored in HttpOnly cookies (managed by the functions).
 */
export const zohoClient = {
  login: () => {
    window.location.href = '/.netlify/functions/zoho-auth';
  },

  api: async (endpoint: string, method: string = 'GET', data?: any, api: string = 'crm'): Promise<any | null> => {
    try {
      const response = await fetch('/.netlify/functions/zoho-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint, method, data, api }),
      });

      if (response.status === 401) {
        return null;
      }

      return await response.json();
    } catch (e) {
      console.warn('Zoho API Fehler:', e);
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
    // Try Zoho Directory first (all org users), fallback to CRM users
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
    // Fallback: CRM users
    const result = await zohoClient.api('users?type=AllUsers');
    return (result?.users || []).map((u: any) => ({ ...u, _source: 'crm' }));
  },

  createQuote: async (payload: any) => {
    return zohoClient.api('Quotes', 'POST', payload);
  },
};
