import { useLocation, Link } from 'react-router-dom';
import {
  ClipboardList, Building2, Download, RefreshCw, Calculator, FileText,
  BarChart3, Wrench, Truck, Monitor, CheckSquare, Calendar,
  Star, Users, Settings, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProjectDevices } from '@/hooks/useProjectData';
import { useSopOrders } from '@/hooks/useSopData';
import { useLocations } from '@/hooks/useRolloutData';
import { useChecklists } from '@/hooks/useChecklistData';

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  requiresProject?: boolean;
  badgeKey?: string;
}

const topNav: NavItem[] = [
  { title: 'Projektübersicht', path: '/', icon: ClipboardList },
];

const phase1Items: NavItem[] = [
  { title: 'Standorte & Raumpläne', path: '/projekt/:id', icon: Building2, requiresProject: true },
  { title: 'IST-Daten Import', path: '/projekt/:id/daten', icon: Download, requiresProject: true },
];

const phase2Items: NavItem[] = [
  { title: 'IST/SOLL Vergleich', path: '/projekt/:id/ist-soll', icon: RefreshCw, requiresProject: true },
  { title: 'Kalkulation', path: '/kalkulation', icon: Calculator },
  { title: 'Konzept', path: '/konzept', icon: FileText },
];

const phase3Items: NavItem[] = [
  { title: 'Rolloutliste', path: '/projekt/:id/rolloutliste', icon: BarChart3, requiresProject: true, badgeKey: 'devices' },
  { title: 'SOP / Vorrichten', path: '/projekt/:id/sop', icon: Wrench, requiresProject: true, badgeKey: 'sop_pending' },
  { title: 'Logistik', path: '/projekt/:id/logistik', icon: Truck, requiresProject: true },
  { title: 'IT / EDV', path: '/projekt/:id/it-edv', icon: Monitor, requiresProject: true },
  { title: 'Checklisten', path: '/projekt/:id/checklisten', icon: CheckSquare, requiresProject: true, badgeKey: 'checklists_open' },
  { title: 'Kalender', path: '/projekt/:id/kalender', icon: Calendar, requiresProject: true },
];

const bottomNav: NavItem[] = [
  { title: 'Team', path: '/einstellungen', icon: Users },
  { title: 'Einstellungen', path: '/einstellungen', icon: Settings },
];

type PhaseStatus = 'idle' | 'active' | 'done';

interface SiriusSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function SiriusSidebar({ mobileOpen, onMobileClose }: SiriusSidebarProps) {
  const location = useLocation();
  const { activeProjectId } = useActiveProject();
  const { data: devices } = useProjectDevices(activeProjectId);
  const { data: sopOrders } = useSopOrders(activeProjectId);
  const { data: locations } = useLocations(activeProjectId);
  const { data: checklists } = useChecklists(activeProjectId);
  const hasProject = !!activeProjectId;

  const totalDevices = devices?.length || 0;
  const checkedDevices = devices?.filter(d => d.preparation_status === 'checked').length || 0;
  const pendingSops = sopOrders?.filter(s => s.preparation_status === 'pending').length || 0;
  const hasLocations = (locations?.length || 0) > 0;
  const hasIstDevices = (devices?.filter(d => d.ist_manufacturer || d.ist_model)?.length || 0) > 0;

  // Checklist open items count
  const checklistOpenCount = checklists?.reduce((acc, cl) => {
    const items = cl.items as Array<{ status?: string }> | null;
    if (!items) return acc;
    return acc + items.filter(i => !i.status || i.status === 'offen').length;
  }, 0) || 0;

  const badges: Record<string, number> = {
    devices: totalDevices,
    sop_pending: pendingSops,
    checklists_open: checklistOpenCount,
  };

  // Phase status
  const phase1Status: PhaseStatus = hasLocations && hasIstDevices ? 'done' : (hasLocations || hasIstDevices) ? 'active' : 'idle';
  const hasSollMapping = (devices?.filter(d => d.soll_model)?.length || 0) > 0;
  const phase2Status: PhaseStatus = hasSollMapping ? 'done' : (hasIstDevices) ? 'active' : 'idle';
  const phase3Status: PhaseStatus = totalDevices > 0 && checkedDevices === totalDevices ? 'done' : totalDevices > 0 ? 'active' : 'idle';

  // Milestones for progress
  const milestones = [
    hasLocations,
    hasIstDevices,
    hasSollMapping,
    false, // kalkulation saved - would need calc data
    pendingSops === 0 && (sopOrders?.length || 0) > 0,
    totalDevices > 0 && checkedDevices === totalDevices,
  ];
  const completedMilestones = milestones.filter(Boolean).length;
  const progressPct = Math.round((completedMilestones / 6) * 100);

  const resolvePath = (path: string) => activeProjectId ? path.replace(':id', activeProjectId) : path;
  const isActive = (path: string) => location.pathname === resolvePath(path);

  const statusDot = (status: PhaseStatus) => (
    <span className={cn(
      'w-2 h-2 rounded-full shrink-0',
      status === 'idle' && 'bg-sidebar-foreground/20',
      status === 'active' && 'bg-primary',
      status === 'done' && 'bg-green-500',
    )} />
  );

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    const disabled = item.requiresProject && !hasProject;
    const resolvedPath = resolvePath(item.path);
    const badgeVal = item.badgeKey ? badges[item.badgeKey] : undefined;

    return (
      <li key={item.path + item.title}>
        <Link
          to={disabled ? '#' : resolvedPath}
          onClick={(e) => { if (disabled) e.preventDefault(); else onMobileClose?.(); }}
          className={cn(
            'flex items-center gap-3 px-5 py-2 text-[13px] rounded-md transition-colors relative',
            active && 'bg-[hsl(216,80%,24%/0.35)] text-sidebar-primary-foreground font-semibold border-l-[3px] border-secondary',
            active && '[&_svg]:text-secondary',
            !active && !disabled && 'text-sidebar-foreground hover:bg-[hsl(0,0%,100%/0.05)] hover:text-[hsl(0,0%,100%/0.85)]',
            disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="font-body flex-1 truncate">{item.title}</span>
          {badgeVal !== undefined && badgeVal > 0 && (
            <span className="text-[10px] font-heading font-bold bg-primary text-sidebar-primary-foreground/90 px-[7px] py-[2px] rounded-[10px] min-w-[20px] text-center">
              {badgeVal}
            </span>
          )}
        </Link>
      </li>
    );
  };

  const phaseHeader = (label: string, status?: PhaseStatus) => (
    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
      <span className="text-[9px] font-heading font-bold uppercase tracking-[2px] text-sidebar-foreground/25 flex-1">
        {label}
      </span>
      {status && statusDot(status)}
    </div>
  );

  const phaseDivider = () => (
    <div className="mx-5 border-t border-sidebar-foreground/[0.08]" />
  );

  const sidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Star className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        <div className="flex flex-col flex-1">
          <span className="font-heading font-extrabold text-sidebar-primary-foreground text-base leading-tight tracking-tight">SIRIUS</span>
          <span className="text-[9px] text-sidebar-foreground/60 font-body leading-tight">document solutions</span>
          <span className="mt-1 inline-block text-[8px] font-heading font-bold bg-primary text-sidebar-primary-foreground px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">MPS Manager</span>
        </div>
        {onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {/* Projekt */}
        <div className="mb-1">
          <div className="px-5 pt-2 pb-1">
            <span className="text-[9px] font-heading font-bold uppercase tracking-[2px] text-sidebar-foreground/25">Projekt</span>
          </div>
          <ul className="space-y-0.5">{topNav.map(renderItem)}</ul>
        </div>

        {phaseDivider()}

        {/* Phase 1 */}
        <div className="mb-1">
          {phaseHeader('Phase 1 · Analyse', phase1Status)}
          <ul className="space-y-0.5">{phase1Items.map(renderItem)}</ul>
        </div>

        {phaseDivider()}

        {/* Phase 2 */}
        <div className="mb-1">
          {phaseHeader('Phase 2 · Planung', phase2Status)}
          <ul className="space-y-0.5">{phase2Items.map(renderItem)}</ul>
        </div>

        {phaseDivider()}

        {/* Phase 3 */}
        <div className="mb-1">
          {phaseHeader('Phase 3 · Rollout', phase3Status)}
          <ul className="space-y-0.5">{phase3Items.map(renderItem)}</ul>
        </div>

        {phaseDivider()}

        {/* Bottom */}
        <div className="mt-2">
          <ul className="space-y-0.5">{bottomNav.map(renderItem)}</ul>
        </div>
      </nav>

      {/* Progress footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-sidebar-foreground/50">Projektfortschritt</span>
          <span className="text-[10px] font-heading font-bold text-sidebar-foreground/50">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-1.5 bg-sidebar-foreground/10 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-secondary" />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen bg-sidebar flex-col z-50 border-r border-sidebar-border w-[252px]">
        {sidebarContent()}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60] lg:hidden" onClick={onMobileClose} />
          <aside className="fixed top-0 left-0 h-screen bg-sidebar flex flex-col z-[70] w-[260px] lg:hidden shadow-2xl">
            {sidebarContent()}
          </aside>
        </>
      )}
    </>
  );
}
