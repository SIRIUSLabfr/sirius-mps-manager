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
    const ZOHO = (window as any).ZOHO;
    if (!ZOHO?.embeddedApp) {
      setIsReady(true);
      return;
    }

    ZOHO.embeddedApp.on("PageLoad", (data: any) => {
      if (data?.EntityId) {
        const id = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
        setDealId(id);
      }
    });

    ZOHO.embeddedApp.init().then(() => {
      ZOHO.CRM.CONFIG.getCurrentUser().then((resp: any) => {
        const u = resp.users?.[0];
        if (u) setZohoUser({ id: u.id, full_name: u.full_name, email: u.email });
        setIsReady(true);
      });
      ZOHO.CRM.UI.Resize({ height: "100%", width: "100%" });
    });
  }, []);

  return (
    <ZohoCtx.Provider value={{ dealId, zohoUser, isReady, ZOHO: (window as any).ZOHO }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
