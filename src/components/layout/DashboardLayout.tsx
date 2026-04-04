import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useZoho } from '@/hooks/useZoho';
import { LogIn, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiriusSidebar from './SiriusSidebar';
import Topbar from './Topbar';

function ZohoLoginGate() {
  const { connectZoho } = useZoho();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">SIRIUS Portal</h1>
          <p className="text-muted-foreground mt-2">
            Bitte melde dich mit deinem Zoho-Konto an, um auf das Portal zuzugreifen.
          </p>
        </div>
        <Button onClick={connectZoho} size="lg" className="w-full gap-2">
          <LogIn className="w-5 h-5" />
          Mit Zoho verbinden
        </Button>
        <p className="text-xs text-muted-foreground">
          Du benötigst ein aktives Zoho CRM Konto bei SIRIUS.
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isZohoConnected } = useZoho();

  // TODO: Re-enable Zoho auth gate after testing
  // if (!isZohoConnected) {
  //   return <ZohoLoginGate />;
  // }

  return (
    <div className="min-h-screen flex">
      <SiriusSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 lg:ml-[252px] flex flex-col min-h-screen">
        <Topbar onMenuToggle={() => setMobileOpen(o => !o)} />
        <main className="flex-1 p-4 sm:p-7 max-w-[1200px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
