/**
 * Zoho SDK wurde entfernt. Diese Datei existiert nur noch als Stub,
 * damit bestehende Imports nicht brechen. Alle Funktionen sind No-Ops.
 */

export const isZohoSDKAvailable = (): boolean => false;

export const zohoAPI = {
  getRecord: async (_entity: string, _recordId: string) => null,
  searchRecord: async (_entity: string, _query: string, _criteria?: string) => null,
  updateRecord: async (_entity: string, _data: any, _trigger?: string[]) => null,
  addNotes: async (_entity: string, _recordId: string, _title: string, _content: string) => null,
  getCurrentUser: async () => null,
  executeFunction: async (_name: string, _args: any) => null,
};
