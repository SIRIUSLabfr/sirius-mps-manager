import { useCallback, useState } from 'react';
import { useZoho } from '@/hooks/useZoho';

export interface ZohoSyncState {
  lastSync: Date | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

/**
 * Automatic Zoho CRM write-back hook.
 * Modules call syncToZoho(dealId, fields) to push data silently.
 */
export function useZohoSync() {
  const { isZohoAvailable } = useZoho();
  const [syncState, setSyncState] = useState<ZohoSyncState>({
    lastSync: null,
    status: 'idle',
  });

  const syncToZoho = useCallback(async (dealId: string | null, fieldUpdates: Record<string, any>) => {
    if (!dealId || !isZohoAvailable()) return;
    const ZOHO = (window as any).ZOHO;
    setSyncState(prev => ({ ...prev, status: 'syncing', errorMessage: undefined }));
    try {
      await ZOHO.CRM.API.updateRecord({
        Entity: 'Deals',
        APIData: { id: dealId, ...fieldUpdates },
        Trigger: ['workflow'],
      });
      setSyncState({ lastSync: new Date(), status: 'success' });
    } catch (err: any) {
      setSyncState({ lastSync: null, status: 'error', errorMessage: err?.message || 'Sync fehlgeschlagen' });
    }
  }, [ZOHO]);

  const syncCalcData = useCallback(async (dealId: string | null, calcData: {
    totalRate?: number;
    deviceCount?: number;
    termMonths?: number;
    financeType?: string;
    volumeBw?: number;
    volumeColor?: number;
    mischklickBw?: number;
    mischklickColor?: number;
  }) => {
    await syncToZoho(dealId, {
      MPS_Monatliche_Rate: calcData.totalRate || 0,
      MPS_Geraeteanzahl: calcData.deviceCount || 0,
      MPS_Laufzeit_Monate: calcData.termMonths || 0,
      MPS_Finanzierungsart: calcData.financeType || '',
      MPS_Volumen_SW: calcData.volumeBw || 0,
      MPS_Volumen_Farbe: calcData.volumeColor || 0,
      MPS_Mischklick_SW: calcData.mischklickBw || 0,
      MPS_Mischklick_Farbe: calcData.mischklickColor || 0,
    });
  }, [syncToZoho]);

  const syncProjectStatus = useCallback(async (dealId: string | null, status: string, projectType: string) => {
    await syncToZoho(dealId, {
      MPS_Projekt_Status: status,
      MPS_Projekt_Typ: projectType === 'daily' ? 'Tagesgeschäft' : 'Projekt',
    });
  }, [syncToZoho]);

  const syncRolloutProgress = useCallback(async (dealId: string | null, progress: {
    percentage: number;
    deliveredCount: number;
    pendingCount: number;
  }) => {
    await syncToZoho(dealId, {
      MPS_Rollout_Fortschritt: progress.percentage,
      MPS_Geraete_Geliefert: progress.deliveredCount,
      MPS_Geraete_Offen: progress.pendingCount,
    });
  }, [syncToZoho]);

  const retrySync = useCallback(() => {
    setSyncState(prev => ({ ...prev, status: 'idle', errorMessage: undefined }));
  }, []);

  return {
    syncState,
    syncToZoho,
    syncCalcData,
    syncProjectStatus,
    syncRolloutProgress,
    retrySync,
  };
}
