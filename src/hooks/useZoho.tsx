import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

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
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  zohoUser: null,
  isReady: false,
  ZOHO: null,
});

export const ZohoProvider = ({ children }: { children: ReactNode }) => {
  const [dealId, setDealId] = useState<string | null>(null);
  const [zohoUser, setZohoUser] = useState<ZohoUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. URL-Parameter prüfen (Custom Button "URL öffnen")
    const urlParams = new URLSearchParams(window.location.search);
    const urlDealId = urlParams.get('deal_id') || urlParams.get('dealId') || urlParams.get('entityId');

    const initZohoSDK = () => {
      const Z = (window as any).ZOHO;
      if (!Z?.embeddedApp) return;
      Z.embeddedApp.init().then(() => {
        Z.CRM.CONFIG.getCurrentUser().then((resp: any) => {
          const u = resp?.users?.[0];
          if (u) setZohoUser({ id: u.id, full_name: u.full_name, email: u.email });
        }).catch(() => {});
        Z.CRM.UI.Resize({ height: "100%", width: "100%" }).catch(() => {});
      }).catch(() => {});
    };

    if (urlDealId) {
      setDealId(urlDealId);
      setIsReady(true);
      initZohoSDK();
      return;
    }

    // 2. Zoho Embedded SDK
    const ZOHO = (window as any).ZOHO;
    if (ZOHO?.embeddedApp) {
      ZOHO.embeddedApp.on("PageLoad", (data: any) => {
        if (data?.EntityId) {
          const id = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
          setDealId(id);
        }
      });
      ZOHO.embeddedApp.init().then(() => {
        ZOHO.CRM.CONFIG.getCurrentUser().then((resp: any) => {
          const u = resp?.users?.[0];
          if (u) setZohoUser({ id: u.id, full_name: u.full_name, email: u.email });
          setIsReady(true);
        }).catch(() => setIsReady(true));
        ZOHO.CRM.UI.Resize({ height: "100%", width: "100%" }).catch(() => {});
      }).catch(() => setIsReady(true));
    } else {
      // 3. Kein Zoho-Kontext
      setIsReady(true);
    }
  }, []);

  return (
    <ZohoCtx.Provider value={{ dealId, zohoUser, isReady, ZOHO: (window as any).ZOHO }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
