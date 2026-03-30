import { useLocation } from 'react-router-dom';
import { User, Wifi, WifiOff, Menu, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoho } from '@/hooks/useZoho';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const routeNames: Record<string, string> = {
  '/projekte': 'MPS-Projekte',
  '/tagesgeschaeft': 'Tagesgeschäft',
  '/sop': 'SOP / Vorrichten',
  '/kalender': 'Kalender',
  '/team': 'Team',
  '/einstellungen': 'Einstellungen',
};

const projectRouteNames: Record<string, string> = {
  '': 'Dashboard',
  '/daily': 'Auftragsübersicht',
  '/standorte': 'Standorte & Raumpläne',
  '/daten': 'IST-Daten Import',
  '/ist-soll': 'IST/SOLL Vergleich',
  '/kalkulation': 'Kalkulation',
  '/konzept': 'Konzept',
  '/rolloutliste': 'Rolloutliste',
  '/sop': 'SOP / Vorrichten',
  '/logistik': 'Logistik',
  '/it-edv': 'IT / EDV',
  '/checklisten': 'Checklisten',
  '/kalender': 'Kalender',
  '/geraete': 'Geräteliste',
};

interface TopbarProps {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location = useLocation();
  const { zohoUser, isZohoAvailable } = useZoho();
  const { activeProjectId } = useActiveProject();
  const { data: project } = useProject(activeProjectId);
  const zohoConnected = isZohoAvailable();

  // Build breadcrumb
  let currentRoute = routeNames[location.pathname] || '';
  let projectName = '';
  if (location.pathname.startsWith('/projekt/') && activeProjectId) {
    const suffix = location.pathname.replace(`/projekt/${activeProjectId}`, '');
    currentRoute = projectRouteNames[suffix] || 'Projekt';
    projectName = project?.customer_name || '';
  }

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-card border-b border-border flex items-center justify-between px-4 sm:px-6">
      {/* Left: menu + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0 h-8 w-8" onClick={onMenuToggle}>
          <Menu className="h-5 w-5" />
        </Button>
        <nav className="flex items-center gap-2 text-sm font-body min-w-0">
          <span className="text-muted-foreground shrink-0 hidden sm:inline">SIRIUS MPS</span>
          <span className="text-muted-foreground shrink-0 hidden sm:inline">/</span>
          {projectName && (
            <>
              <span className="text-muted-foreground truncate max-w-[180px]">{projectName}</span>
              <span className="text-muted-foreground shrink-0">/</span>
            </>
          )}
          <span className="font-heading font-semibold text-foreground shrink-0">{currentRoute}</span>
        </nav>
      </div>

      {/* Right: Zoho sync status + user */}
      <div className="flex items-center gap-3 shrink-0">
        {isZohoAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-secondary cursor-default">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline font-heading">Zoho verbunden</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Automatischer Sync aktiv. Daten werden bei Änderungen automatisch nach Zoho geschrieben.</p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 text-sm font-body">
          {isZohoAvailable ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-secondary" />
              <User className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              <span className="text-foreground hidden sm:inline">{zohoUser?.full_name || 'Laden...'}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground hidden sm:inline">Offline / Dev Mode</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
