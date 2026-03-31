import { createContext, useContext, useState, ReactNode } from 'react';

interface ZohoContextType {
  dealId: string | null;
  isReady: boolean;
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  isReady: false,
});

export const ZohoProvider = ({ children }: { children: ReactNode }) => {
  const [dealId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('deal_id') || params.get('dealId') || params.get('entityId');
    if (urlId) {
      sessionStorage.setItem('zoho_deal_id', urlId);
      return urlId;
    }
    return sessionStorage.getItem('zoho_deal_id') || null;
  });

  return (
    <ZohoCtx.Provider value={{ dealId, isReady: true }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
