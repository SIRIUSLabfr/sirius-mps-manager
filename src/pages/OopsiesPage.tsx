import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProjects } from '@/hooks/useProjectData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OopsieMessage {
  projectId: string;
  customerName: string;
  projectType: string;
  message: string;
}

export default function OopsiesPage() {
  const { data: projects } = useProjects();

  const activeProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => p.status !== 'completed');
  }, [projects]);

  const projectIds = useMemo(() => activeProjects.map(p => p.id), [activeProjects]);

  const { data: allSops } = useQuery({
    queryKey: ['oopsies_sops_page', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('sop_orders')
        .select('*')
        .in('project_id', projectIds);
      if (error) throw error;
      return data;
    },
    enabled: projectIds.length > 0,
  });

  const oopsies = useMemo(() => {
    const messages: OopsieMessage[] = [];
    const today = new Date().toISOString().split('T')[0];
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoStr = twoMonthsAgo.toISOString().split('T')[0];

    for (const project of activeProjects) {
      const projectSops = (allSops || []).filter(s => s.project_id === project.id);
      const pType = (project as any).project_type || 'project';
      const typeLabel = pType === 'daily' ? 'Tagesgeschäft' : 'MPS-Projekt';

      const overdueNotStarted = projectSops.filter(s =>
        s.delivery_date && s.delivery_date < today &&
        (s.preparation_status === 'pending' || s.preparation_status === 'in_progress')
      );
      if (overdueNotStarted.length > 0) {
        messages.push({
          projectId: project.id,
          customerName: project.customer_name,
          projectType: typeLabel,
          message: `${overdueNotStarted.length} Gerät(e) – Lieferdatum überschritten, Status noch „${overdueNotStarted[0].preparation_status === 'pending' ? 'Ausstehend' : 'In Bearbeitung'}"`,
        });
      }

      const longOverdue = projectSops.filter(s =>
        s.delivery_date && s.delivery_date < twoMonthsAgoStr
      );
      if (longOverdue.length > 0) {
        messages.push({
          projectId: project.id,
          customerName: project.customer_name,
          projectType: typeLabel,
          message: `Lieferdatum um über 2 Monate überschritten – ${typeLabel} nicht abgeschlossen`,
        });
      }
    }

    return messages;
  }, [activeProjects, allSops]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">oopsies</h1>

      {oopsies.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-6">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-heading font-semibold text-foreground">Alles in Ordnung!</p>
            <p className="text-sm text-muted-foreground">Keine offenen Probleme gefunden.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {oopsies.map((o, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold text-foreground">{o.customerName}</span>
                  <span className="text-[10px] font-heading bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{o.projectType}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{o.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
