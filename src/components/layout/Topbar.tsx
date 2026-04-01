import { useLocation } from 'react-router-dom';
import { User, Menu, Zap } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { Button } from '@/components/ui/button';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';
import { useZoho } from '@/hooks/useZoho';

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
  '/daten': 'Projektdaten',
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
  const { activeProjectId } = useActiveProject();
  const { data: project } = useProject(activeProjectId);
  const { isZohoConnected, zohoUser, connectZoho } = useZoho();

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

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Zoho connection status */}
        {isZohoConnected ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="hidden sm:inline truncate max-w-[140px]">
              {zohoUser?.full_name || 'Zoho verbunden'}
            </span>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={connectZoho}>
            <Zap className="h-3 w-3" />
            <span className="hidden sm:inline">Mit Zoho verbinden</span>
          </Button>
        )}

        <NotificationBell />

        <div className="flex items-center gap-2 text-sm font-body">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground hidden sm:inline">SIRIUS MPS</span>
        </div>
      </div>
    </header>
  );
}
