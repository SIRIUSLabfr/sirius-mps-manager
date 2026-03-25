import { useLocation } from 'react-router-dom';
import { Download, Upload, User, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoho } from '@/hooks/useZoho';

const routeNames: Record<string, string> = {
  '/': 'Projektübersicht',
  '/projektdaten': 'Projektdaten',
  '/ist-soll': 'IST/SOLL Vergleich',
  '/rolloutliste': 'Rolloutliste',
  '/sop': 'SOP / Vorrichten',
  '/logistik': 'Logistik',
  '/it-edv': 'IT / EDV',
  '/checklisten': 'Checklisten',
  '/kalender': 'Kalender',
  '/kalkulation': 'Kalkulation',
  '/konzept': 'Konzept',
};

export default function Topbar() {
  const location = useLocation();
  const { zohoUser, isReady, ZOHO } = useZoho();
  const currentRoute = routeNames[location.pathname] || 'Seite';
  const isZohoAvailable = !!ZOHO?.embeddedApp;

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-card border-b border-border flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-body">
        <span className="text-muted-foreground">SIRIUS MPS</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-heading font-semibold text-foreground">{currentRoute}</span>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2 font-heading text-xs">
          <Download className="h-3.5 w-3.5" />
          Von Zoho laden
        </Button>
        <Button size="sm" className="gap-2 font-heading text-xs">
          <Upload className="h-3.5 w-3.5" />
          Nach Zoho schreiben
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        <div className="flex items-center gap-2 text-sm font-body">
          {isZohoAvailable ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-secondary" />
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{zohoUser?.full_name || 'Laden...'}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Offline / Dev Mode</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
