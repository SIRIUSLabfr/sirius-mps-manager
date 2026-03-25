import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { formatDate } from '@/lib/constants';
import SummaryCard from '@/components/SummaryCard';
import StatusChip from '@/components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: devices } = useProjectDevices(projectId || null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  if (isLoading) {
    return <div className="text-muted-foreground py-12 text-center">Lade Projektdaten...</div>;
  }

  if (!project) {
    return <div className="text-muted-foreground py-12 text-center">Projekt nicht gefunden.</div>;
  }

  const totalDevices = devices?.length || 0;
  const prepared = devices?.filter(d => ['prepared', 'delivered', 'installed', 'checked'].includes(d.preparation_status)).length || 0;
  const delivered = devices?.filter(d => ['delivered', 'installed', 'checked'].includes(d.preparation_status)).length || 0;
  const openIssues = devices?.filter(d => d.preparation_status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">
        {project.customer_name}
        {project.project_name ? ` – ${project.project_name}` : ''}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Gesamtgeräte" value={totalDevices} color="bg-primary" />
        <SummaryCard label="Vorgerichtet" value={prepared} color="bg-emerald-500" total={totalDevices} showProgress />
        <SummaryCard label="Ausgeliefert" value={delivered} color="bg-secondary" total={totalDevices} showProgress />
        <SummaryCard label="Offene Punkte" value={openIssues} color="bg-destructive" isAlert />
      </div>

      {/* Project Info */}
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
              <p className="font-medium">
                {formatDate(project.rollout_start)} – {formatDate(project.rollout_end)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Letzte Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
            <span className="text-muted-foreground text-sm">Aktivitäten-Feed wird in einem späteren Schritt implementiert.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
