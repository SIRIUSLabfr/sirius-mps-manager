/**
 * Zoho SDK wurde entfernt. Dieser Hook ist ein No-Op Stub,
 * bis eine REST-API-basierte Sync-Lösung implementiert wird.
 */
import { useState, useCallback } from 'react';

export interface ZohoSyncState {
  lastSync: Date | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export function useZohoSync() {
  const [syncState] = useState<ZohoSyncState>({ lastSync: null, status: 'idle' });

  const syncToZoho = useCallback(async (_dealId: string | null, _fieldUpdates: Record<string, any>) => {}, []);
  const syncCalcData = useCallback(async (_dealId: string | null, _calcData: any) => {}, []);
  const syncProjectStatus = useCallback(async (_dealId: string | null, _status: string, _projectType: string) => {}, []);
  const syncRolloutProgress = useCallback(async (_dealId: string | null, _progress: any) => {}, []);
  const retrySync = useCallback(() => {}, []);

  return { syncState, syncToZoho, syncCalcData, syncProjectStatus, syncRolloutProgress, retrySync };
}
