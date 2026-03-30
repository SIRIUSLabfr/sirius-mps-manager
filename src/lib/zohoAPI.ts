/**
 * Central Zoho CRM API wrapper.
 * All Zoho SDK calls MUST go through these functions.
 * They check iframe + SDK availability first to prevent
 * "Parentwindow reference not found" and similar errors.
 */

export const isZohoSDKAvailable = (): boolean => {
  try {
    const isInIframe = window.self !== window.top;
    const ZOHO = (window as any).ZOHO;
    return isInIframe && !!ZOHO?.CRM?.API;
  } catch {
    return false;
  }
};

export const zohoAPI = {
  getRecord: async (entity: string, recordId: string) => {
    if (!isZohoSDKAvailable()) return null;
    try {
      const result = await (window as any).ZOHO.CRM.API.getRecord({ Entity: entity, RecordID: recordId });
      return result?.data?.[0] || null;
    } catch (e) {
      console.warn('Zoho API getRecord fehlgeschlagen:', e);
      return null;
    }
  },

  searchRecord: async (entity: string, query: string, criteria?: string) => {
    if (!isZohoSDKAvailable()) return null;
    try {
      const params: any = { Entity: entity, Type: 'word', Query: query };
      if (criteria) params.Criteria = criteria;
      const result = await (window as any).ZOHO.CRM.API.searchRecord(params);
      return result?.data || null;
    } catch (e) {
      console.warn('Zoho API searchRecord fehlgeschlagen:', e);
      return null;
    }
  },

  updateRecord: async (entity: string, data: any, trigger?: string[]) => {
    if (!isZohoSDKAvailable()) return null;
    try {
      const params: any = { Entity: entity, APIData: data };
      if (trigger) params.Trigger = trigger;
      return await (window as any).ZOHO.CRM.API.updateRecord(params);
    } catch (e) {
      console.warn('Zoho API updateRecord fehlgeschlagen:', e);
      return null;
    }
  },

  addNotes: async (entity: string, recordId: string, title: string, content: string) => {
    if (!isZohoSDKAvailable()) return null;
    try {
      return await (window as any).ZOHO.CRM.API.addNotes({
        Entity: entity,
        RecordID: recordId,
        Title: title,
        Note_Content: content,
      });
    } catch (e) {
      console.warn('Zoho API addNotes fehlgeschlagen:', e);
      return null;
    }
  },

  getCurrentUser: async () => {
    if (!isZohoSDKAvailable()) return null;
    try {
      const result = await (window as any).ZOHO.CRM.CONFIG.getCurrentUser();
      return result?.users?.[0] || null;
    } catch (e) {
      console.warn('Zoho getCurrentUser fehlgeschlagen:', e);
      return null;
    }
  },

  executeFunction: async (name: string, args: any) => {
    if (!isZohoSDKAvailable()) return null;
    try {
      return await (window as any).ZOHO.CRM.FUNCTIONS.execute(name, {
        arguments: JSON.stringify(args),
      });
    } catch (e) {
      console.warn('Zoho Function fehlgeschlagen:', e);
      return null;
    }
  },
};
