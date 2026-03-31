import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { zohoClient } from '@/lib/zohoClient';

interface ZohoContextType {
  dealId: string | null;
  isReady: boolean;
  isZohoConnected: boolean;
  zohoUser: { full_name: string; email: string } | null;
  connectZoho: () => void;
}

const ZohoCtx = createContext<ZohoContextType>({
  dealId: null,
  isReady: false,
  isZohoConnected: false,
  zohoUser: null,
  connectZoho: () => {},
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

  const [isZohoConnected, setIsZohoConnected] = useState(false);
  const [zohoUser, setZohoUser] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    // Check if we have a valid Zoho session (cookie-based)
    zohoClient.getCurrentUser().then((user) => {
      if (user) {
        setIsZohoConnected(true);
        setZohoUser({ full_name: user.full_name || user.name || '', email: user.email || '' });
      }
    });
  }, []);

  const connectZoho = () => {
    zohoClient.login();
  };

  return (
    <ZohoCtx.Provider value={{ dealId, isReady: true, isZohoConnected, zohoUser, connectZoho }}>
      {children}
    </ZohoCtx.Provider>
  );
};

export const useZoho = () => useContext(ZohoCtx);
