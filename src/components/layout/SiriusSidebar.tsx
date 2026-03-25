import { useLocation, Link } from 'react-router-dom';
import {
  ClipboardList, FolderOpen, RefreshCw, BarChart3, Wrench,
  Truck, Monitor, CheckSquare, Calendar, Calculator, FileText,
  Star, ChevronLeft, ChevronRight, LayoutDashboard, Settings, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProjectDevices } from '@/hooks/useProjectData';
import { useSopOrders } from '@/hooks/useSopData';

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  requiresProject?: boolean;
  badgeKey?: string;
}

const projecteSection: NavItem[] = [
  { title: 'Projektübersicht', path: '/', icon: ClipboardList },
];

const aktuellesProjektSection: NavItem[] = [
  { title: 'Dashboard', path: '/projekt/:id', icon: LayoutDashboard, requiresProject: true },
  { title: 'Projektdaten', path: '/projekt/:id/daten', icon: FolderOpen, requiresProject: true },
  { title: 'IST/SOLL Vergleich', path: '/projekt/:id/ist-soll', icon: RefreshCw, requiresProject: true },
  { title: 'Rolloutliste', path: '/projekt/:id/rolloutliste', icon: BarChart3, requiresProject: true, badgeKey: 'devices' },
  { title: 'SOP / Vorrichten', path: '/projekt/:id/sop', icon: Wrench, requiresProject: true, badgeKey: 'sop_pending' },
  { title: 'Logistik', path: '/projekt/:id/logistik', icon: Truck, requiresProject: true },
  { title: 'IT / EDV', path: '/projekt/:id/it-edv', icon: Monitor, requiresProject: true },
  { title: 'Checklisten', path: '/projekt/:id/checklisten', icon: CheckSquare, requiresProject: true },
  { title: 'Kalender', path: '/projekt/:id/kalender', icon: Calendar, requiresProject: true },
];

const phase2Section: NavItem[] = [
  { title: 'Kalkulation', path: '/kalkulation', icon: Calculator },
  { title: 'Konzept', path: '/konzept', icon: FileText },
];

const settingsSection: NavItem[] = [
  { title: 'Team & Einstellungen', path: '/einstellungen', icon: Settings },
];

interface SiriusSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function SiriusSidebar({ mobileOpen, onMobileClose }: SiriusSidebarProps) {
  const location = useLocation();
  const { activeProjectId } = useActiveProject();
  const { data: devices } = useProjectDevices(activeProjectId);
  const { data: sopOrders } = useSopOrders(activeProjectId);
  const hasProject = !!activeProjectId;

  const totalDevices = devices?.length || 0;
  const checkedDevices = devices?.filter(d => d.preparation_status === 'checked').length || 0;
  const progressPct = totalDevices > 0 ? Math.round((checkedDevices / totalDevices) * 100) : 0;
  const pendingSops = sopOrders?.filter(s => s.preparation_status === 'pending').length || 0;

  const badges: Record<string, number> = {
    devices: totalDevices,
    sop_pending: pendingSops,
  };

  const resolvePath = (path: string) => activeProjectId ? path.replace(':id', activeProjectId) : path;
  const isActive = (path: string) => location.pathname === resolvePath(path);

  const renderItem = (item: NavItem, collapsed: boolean) => {
    const active = isActive(item.path);
    const disabled = item.requiresProject && !hasProject;
    const resolvedPath = resolvePath(item.path);
    const badgeVal = item.badgeKey ? badges[item.badgeKey] : undefined;

    return (
      <li key={item.path}>
        <Link
          to={disabled ? '#' : resolvedPath}
          onClick={(e) => { if (disabled) e.preventDefault(); else onMobileClose?.(); }}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors relative',
            active && 'bg-sidebar-accent text-sidebar-primary-foreground border-l-[3px] border-sidebar-primary',
            !active && !disabled && 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-body flex-1">{item.title}</span>}
          {!collapsed && badgeVal !== undefined && badgeVal > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 min-w-[20px] justify-center px-1 font-heading bg-sidebar-primary/20 text-sidebar-primary-foreground border-0">
              {badgeVal}
            </Badge>
          )}
        </Link>
      </li>
    );
  };

  const renderSection = (label: string, items: NavItem[], collapsed: boolean, extraInfo?: string) => (
    <div className="mb-2" key={label}>
      {!collapsed && (
        <div className="px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] font-heading font-bold uppercase tracking-widest text-sidebar-foreground/50">{label}</p>
          {extraInfo && <span className="text-[9px] text-sidebar-foreground/30">{extraInfo}</span>}
        </div>
      )}
      <ul className="space-y-0.5">{items.map(i => renderItem(i, collapsed))}</ul>
    </div>
  );

  const sidebarContent = (collapsed: boolean) => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Star className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="flex flex-col flex-1">
            <span className="font-heading font-extrabold text-sidebar-primary-foreground text-base leading-tight tracking-tight">SIRIUS</span>
            <span className="text-[9px] text-sidebar-foreground/60 font-body leading-tight">document solutions</span>
            <span className="mt-1 inline-block text-[8px] font-heading font-bold bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">MPS Manager</span>
          </div>
        )}
        {/* Mobile close */}
        {!collapsed && onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {renderSection('Projekte', projecteSection, collapsed)}
        {renderSection('Aktuelles Projekt', aktuellesProjektSection, collapsed, !hasProject ? 'kein Projekt' : undefined)}
        {renderSection('Phase 2', phase2Section, collapsed)}
        {renderSection('System', settingsSection, collapsed)}
      </nav>

      {/* Progress */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">Rollout-Fortschritt</p>
          <div className="relative">
            <Progress value={progressPct} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-secondary" />
          </div>
          <p className="text-[10px] text-sidebar-foreground/50 mt-1 text-right">{progressPct} %</p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen bg-sidebar flex-col z-50 transition-all duration-200 border-r border-sidebar-border w-[252px]">
        {sidebarContent(false)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60] lg:hidden" onClick={onMobileClose} />
          <aside className="fixed top-0 left-0 h-screen bg-sidebar flex flex-col z-[70] w-[280px] lg:hidden shadow-2xl">
            {sidebarContent(false)}
          </aside>
        </>
      )}
    </>
  );
}
