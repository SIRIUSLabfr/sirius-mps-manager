import { useLocation } from 'react-router-dom';
import { Download, Upload, User, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoho } from '@/hooks/useZoho';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';

const routeNames: Record<string, string> = {
  '/': 'Projektübersicht',
  '/kalkulation': 'Kalkulation',
  '/konzept': 'Konzept',
};

const projectRouteNames: Record<string, string> = {
  '': 'Dashboard',
  '/daten': 'Projektdaten',
  '/ist-soll': 'IST/SOLL Vergleich',
  '/rolloutliste': 'Rolloutliste',
  '/sop': 'SOP / Vorrichten',
  '/logistik': 'Logistik',
  '/it-edv': 'IT / EDV',
  '/checklisten': 'Checklisten',
  '/kalender': 'Kalender',
};

export default function Topbar() {
  const location = useLocation();
  const { zohoUser, ZOHO } = useZoho();
  const { activeProjectId } = useActiveProject();
  const { data: project } = useProject(activeProjectId);
  const isZohoAvailable = !!ZOHO?.embeddedApp;

  // Determine current route name
  let currentRoute = routeNames[location.pathname] || '';
  let projectName = '';
  if (location.pathname.startsWith('/projekt/') && activeProjectId) {
    const suffix = location.pathname.replace(`/projekt/${activeProjectId}`, '');
    currentRoute = projectRouteNames[suffix] || 'Projekt';
    projectName = project?.customer_name || '';
  }

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-card border-b border-border flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-body min-w-0">
        <span className="text-muted-foreground shrink-0">SIRIUS MPS</span>
        <span className="text-muted-foreground shrink-0">/</span>
        {projectName && (
          <>
            <span className="text-muted-foreground truncate max-w-[180px]">{projectName}</span>
            <span className="text-muted-foreground shrink-0">/</span>
          </>
        )}
        <span className="font-heading font-semibold text-foreground shrink-0">{currentRoute}</span>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
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
