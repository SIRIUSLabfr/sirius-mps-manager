import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { isZohoSDKAvailable, zohoAPI } from '@/lib/zohoAPI';

interface ZohoUser {
  id: string;
  full_name: string;
  email: string;
}

interface ZohoContextType {
  dealId: string | null;
  zohoUser: ZohoUser | null;
  isReady: boolean;
  isZohoAvailable: () => boolean;
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  zohoUser: null,
  isReady: false,
  isZohoAvailable: () => false,
});

export const ZohoProvider = ({ children }: { children: ReactNode }) => {
  const [dealId, setDealId] = useState<string | null>(() => {
    return sessionStorage.getItem('zoho_deal_id') || null;
  });
  const [zohoUser, setZohoUser] = useState<ZohoUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedDealId = sessionStorage.getItem('zoho_deal_id');
    if (storedDealId) {
      setDealId(storedDealId);
    }

    // SDK NUR im iframe initialisieren
    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = false;
    }

    const ZOHO = (window as any).ZOHO;

    if (isInIframe && ZOHO?.embeddedApp) {
      try {
        ZOHO.embeddedApp.on("PageLoad", (data: any) => {
          if (data?.EntityId) {
            const id = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
            setDealId(id);
            sessionStorage.setItem('zoho_deal_id', id);
          }
          setIsReady(true);
        });
        ZOHO.embeddedApp.init().then(async () => {
          const user = await zohoAPI.getCurrentUser();
          if (user) setZohoUser({ id: user.id, full_name: user.full_name, email: user.email });
          ZOHO.CRM.UI.Resize({ height: "100%", width: "100%" }).catch(() => {});
        }).catch(() => {
          setIsReady(true);
        });
      } catch (e) {
        console.log('Zoho SDK init fehlgeschlagen:', e);
        setIsReady(true);
      }
    } else {
      setIsReady(true);
    }
  }, []);

  return (
    <ZohoCtx.Provider value={{ dealId, zohoUser, isReady, isZohoAvailable: isZohoSDKAvailable }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
