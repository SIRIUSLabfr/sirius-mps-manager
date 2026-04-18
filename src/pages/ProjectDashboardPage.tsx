import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useSopOrders } from '@/hooks/useSopData';
import { formatDate } from '@/lib/constants';
import SummaryCard from '@/components/SummaryCard';
import StatusChip from '@/components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Package, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import PotentialOverviewPage from './PotentialOverviewPage';

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: devices } = useProjectDevices(projectId || null);
  const { data: sopOrders } = useSopOrders(projectId || null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  // Build activity feed from recent device/sop changes
  const activities = useMemo(() => {
    const items: { id: string; text: string; time: Date }[] = [];

    devices?.forEach(d => {
      if (!d.updated_at) return;
      const model = d.soll_model || d.ist_model || 'Gerät';
      const serial = d.soll_serial || d.ist_serial || '';
      const statusMap: Record<string, string> = {
        pending: 'als ausstehend markiert',
        in_progress: 'in Bearbeitung genommen',
        prepared: 'als vorgerichtet markiert',
        delivered: 'als ausgeliefert markiert',
        checked: 'als geprüft markiert',
      };
      const action = statusMap[d.preparation_status] || 'aktualisiert';
      items.push({
        id: `d-${d.id}`,
        text: `${model}${serial ? ` (SN ${serial})` : ''} ${action}`,
        time: new Date(d.updated_at),
      });
    });

    sopOrders?.forEach(s => {
      if (!s.updated_at) return;
      const model = s.model || 'SOP';
      items.push({
        id: `s-${s.id}`,
        text: `SOP: ${model}${s.serial_number ? ` (${s.serial_number})` : ''} – Status: ${s.preparation_status}`,
        time: new Date(s.updated_at),
      });
    });

    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);
  }, [devices, sopOrders]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-16 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">Projekt nicht gefunden.</p>
      </div>
    );
  }

  const totalDevices = devices?.length || 0;
  const prepared = devices?.filter(d => ['prepared', 'delivered', 'installed', 'checked'].includes(d.preparation_status)).length || 0;
  const delivered = devices?.filter(d => ['delivered', 'installed', 'checked'].includes(d.preparation_status)).length || 0;
  const openIssues = devices?.filter(d => d.preparation_status === 'pending').length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-lg sm:text-2xl font-heading font-bold text-foreground leading-tight">
        {project.customer_name}
        {project.project_name ? ` – ${project.project_name}` : ''}
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <SummaryCard label="Gesamtgeräte" value={totalDevices} color="bg-primary" />
        <SummaryCard label="Vorgerichtet" value={prepared} color="bg-emerald-500" total={totalDevices} showProgress />
        <SummaryCard label="Ausgeliefert" value={delivered} color="bg-secondary" total={totalDevices} showProgress />
        <SummaryCard label="Offene Punkte" value={openIssues} color="bg-destructive" isAlert />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Projektinformationen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Kunde</p>
              <p className="font-medium">{project.customer_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Projektnummer</p>
              <p className="font-medium">{project.project_number || '–'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Status</p>
              <StatusChip status={project.status} />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Zeitraum</p>
              <p className="font-medium">{formatDate(project.rollout_start)} – {formatDate(project.rollout_end)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Letzte Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten. Importiere Geräte oder erstelle SOPs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body">{a.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(a.time, { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
