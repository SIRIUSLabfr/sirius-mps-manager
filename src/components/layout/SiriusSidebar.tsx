import { useLocation, Link } from 'react-router-dom';
import {
  ClipboardList, FolderOpen, RefreshCw, BarChart3, Wrench,
  Truck, Monitor, CheckSquare, Calendar, Calculator, FileText,
  Star, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { useZoho } from '@/hooks/useZoho';

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  requiresProject?: boolean;
}

const projecteSection: NavItem[] = [
  { title: 'Projektübersicht', path: '/', icon: ClipboardList },
];

const aktuellesProjektSection: NavItem[] = [
  { title: 'Projektdaten', path: '/projektdaten', icon: FolderOpen, requiresProject: true },
  { title: 'IST/SOLL Vergleich', path: '/ist-soll', icon: RefreshCw, requiresProject: true },
  { title: 'Rolloutliste', path: '/rolloutliste', icon: BarChart3, requiresProject: true },
  { title: 'SOP / Vorrichten', path: '/sop', icon: Wrench, requiresProject: true },
  { title: 'Logistik', path: '/logistik', icon: Truck, requiresProject: true },
  { title: 'IT / EDV', path: '/it-edv', icon: Monitor, requiresProject: true },
  { title: 'Checklisten', path: '/checklisten', icon: CheckSquare, requiresProject: true },
  { title: 'Kalender', path: '/kalender', icon: Calendar, requiresProject: true },
];

const phase2Section: NavItem[] = [
  { title: 'Kalkulation', path: '/kalkulation', icon: Calculator },
  { title: 'Konzept', path: '/konzept', icon: FileText },
];

export default function SiriusSidebar() {
  const location = useLocation();
  const { dealId } = useZoho();
  const [collapsed, setCollapsed] = useState(false);
  const hasProject = !!dealId;

  const renderItem = (item: NavItem) => {
    const active = location.pathname === item.path;
    const disabled = item.requiresProject && !hasProject;

    return (
      <li key={item.path}>
        <Link
          to={disabled ? '#' : item.path}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors relative',
            active && 'bg-sidebar-accent text-sidebar-primary-foreground border-l-[3px] border-sidebar-primary',
            !active && !disabled && 'text-sidebar-foreground hover:bg-sidebar-accent/50',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          )}
          onClick={(e) => disabled && e.preventDefault()}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-body">{item.title}</span>}
        </Link>
      </li>
    );
  };

  const renderSection = (label: string, items: NavItem[]) => (
    <div className="mb-2">
      {!collapsed && (
        <p className="px-4 py-2 text-[10px] font-heading font-bold uppercase tracking-widest text-sidebar-foreground/50">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">{items.map(renderItem)}</ul>
    </div>
  );

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen bg-sidebar flex flex-col z-50 transition-all duration-200 border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-[252px]'
      )}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Star className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-heading font-extrabold text-sidebar-primary-foreground text-base leading-tight tracking-tight">
              SIRIUS
            </span>
            <span className="text-[9px] text-sidebar-foreground/60 font-body leading-tight">
              document solutions
            </span>
            <span className="mt-1 inline-block text-[8px] font-heading font-bold bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">
              MPS Manager
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {renderSection('Projekte', projecteSection)}
        {renderSection('Aktuelles Projekt', aktuellesProjektSection)}
        {renderSection('Phase 2', phase2Section)}
      </nav>

      {/* Progress */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
            Rollout-Fortschritt
          </p>
          <Progress value={0} className="h-2" />
          <p className="text-[10px] text-sidebar-foreground/50 mt-1 text-right">0 %</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 mx-2 mb-2 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
