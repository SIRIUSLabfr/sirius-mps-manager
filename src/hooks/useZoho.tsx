import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';

interface ZohoUser {
  id: string;
  full_name: string;
  email: string;
}

interface ZohoContextType {
  dealId: string | null;
  zohoUser: ZohoUser | null;
  isReady: boolean;
  ZOHO: any;
  isZohoAvailable: () => boolean;
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  zohoUser: null,
  isReady: false,
  ZOHO: null,
  isZohoAvailable: () => false,
});

/** Check if we're inside a Zoho iframe with SDK available */
const checkZohoAvailable = (): boolean => {
  try {
    const isInIframe = window.self !== window.top;
    const Z = (window as any).ZOHO;
    return isInIframe && !!Z?.CRM;
  } catch {
    return false;
  }
};

export const ZohoProvider = ({ children }: { children: ReactNode }) => {
  const [dealId, setDealId] = useState<string | null>(() => {
    return sessionStorage.getItem('zoho_deal_id') || null;
  });
  const [zohoUser, setZohoUser] = useState<ZohoUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const isZohoAvailable = useCallback(checkZohoAvailable, []);

  useEffect(() => {
    // 1. Deal-ID aus sessionStorage (wurde in main.tsx synchron gespeichert)
    const storedDealId = sessionStorage.getItem('zoho_deal_id');
    if (storedDealId) {
      setDealId(storedDealId);
    }

    // 2. Zoho SDK NUR initialisieren wenn wir in einem iframe laufen
    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = false;
    }

    const ZOHO = (window as any).ZOHO;

    if (isInIframe && ZOHO?.embeddedApp) {
      // App läuft als Zoho Widget im iframe → SDK nutzen
      try {
        ZOHO.embeddedApp.on("PageLoad", (data: any) => {
          if (data?.EntityId) {
            const id = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
            setDealId(id);
            sessionStorage.setItem('zoho_deal_id', id);
          }
          setIsReady(true);
        });
        ZOHO.embeddedApp.init().then(() => {
          ZOHO.CRM.CONFIG.getCurrentUser().then((resp: any) => {
            const u = resp?.users?.[0];
            if (u) setZohoUser({ id: u.id, full_name: u.full_name, email: u.email });
          }).catch(() => {});
          ZOHO.CRM.UI.Resize({ height: "100%", width: "100%" }).catch(() => {});
        }).catch(() => {
          setIsReady(true);
        });
      } catch (e) {
        console.log('Zoho SDK init fehlgeschlagen:', e);
        setIsReady(true);
      }
    } else {
      // App läuft als eigenständiger Tab → KEIN SDK init
      setIsReady(true);
    }
  }, []);

  return (
    <ZohoCtx.Provider value={{ dealId, zohoUser, isReady, ZOHO: (window as any).ZOHO, isZohoAvailable }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
