import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { zohoAPI } from '@/lib/zohoAPI';

interface ZohoUser {
  id: string;
  full_name: string;
  email: string;
}

interface ZohoContextType {
  dealId: string | null;
  zohoUser: ZohoUser | null;
  isReady: boolean;
  isZohoConnected: boolean;
  isZohoAvailable: () => boolean;
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  zohoUser: null,
  isReady: false,
  isZohoConnected: false,
  isZohoAvailable: () => false,
});

const checkZohoSDK = (): boolean => {
  try {
    return window.self !== window.top && !!(window as any).ZOHO?.embeddedApp;
  } catch {
    return false;
  }
};

export const ZohoProvider = ({ children }: { children: ReactNode }) => {
  const [dealId, setDealId] = useState<string | null>(
    sessionStorage.getItem('zoho_deal_id')
  );
  const [zohoUser, setZohoUser] = useState<ZohoUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isZohoConnected, setIsZohoConnected] = useState(false);

  const checkAvailable = (): boolean => {
    try {
      const isInIframe = window.self !== window.top;
      const Z = (window as any).ZOHO;
      return isInIframe && !!Z?.CRM?.API;
    } catch { return false; }
  };

  useEffect(() => {
    const ZOHO = (window as any).ZOHO;
    const sdkAvailable = checkZohoSDK();

    console.log('[Zoho] SDK check:', { sdkAvailable, hasZOHO: !!ZOHO, inIframe: (() => { try { return window.self !== window.top; } catch { return false; } })() });

    if (sdkAvailable) {
      console.log('[Zoho] SDK verfügbar, initialisiere...');

      // WICHTIG: Zuerst Listener registrieren, DANN init()
      ZOHO.embeddedApp.on("PageLoad", function(data: any) {
        console.log('[Zoho] PageLoad Event:', JSON.stringify(data));

        if (data) {
          const entityId = data.EntityId || data.entityId || data.entity_id;
          if (entityId) {
            const id = Array.isArray(entityId) ? entityId[0] : String(entityId);
            console.log('[Zoho] Deal-ID erkannt:', id);
            setDealId(id);
            sessionStorage.setItem('zoho_deal_id', id);
          }
        }
        setIsReady(true);
      });

      // DANN init aufrufen
      ZOHO.embeddedApp.init()
        .then(async function() {
          console.log('[Zoho] SDK init erfolgreich');
          setIsZohoConnected(true);

          const user = await zohoAPI.getCurrentUser();
          if (user) {
            console.log('[Zoho] User:', user.full_name);
            setZohoUser({ id: user.id, full_name: user.full_name, email: user.email });
          }

          try {
            ZOHO.CRM.UI.Resize({ height: "100%", width: "100%" }).catch(() => {});
          } catch {}
        })
        .catch(function(err: any) {
          console.warn('[Zoho] SDK init Fehler:', err);
          setIsReady(true);
        });

      // Timeout falls PageLoad nie feuert
      setTimeout(() => {
        setIsReady(prev => {
          if (!prev) {
            console.warn('[Zoho] PageLoad Timeout - setze ready ohne Deal-ID');
            return true;
          }
          return prev;
        });
      }, 5000);

    } else {
      console.log('[Zoho] Kein SDK, nutze URL-Parameter. Deal-ID:', sessionStorage.getItem('zoho_deal_id'));
      setIsReady(true);
    }
  }, []);

  return (
    <ZohoCtx.Provider value={{ dealId, zohoUser, isReady, isZohoConnected, isZohoAvailable: checkAvailable }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
