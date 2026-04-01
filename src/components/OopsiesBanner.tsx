import { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useProjects } from '@/hooks/useProjectData';
import { useSopOrders } from '@/hooks/useSopData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OopsieMessage {
  projectId: string;
  customerName: string;
  message: string;
  severity: 'warning' | 'error';
}

function useAllSopOrders(projectType: 'project' | 'daily') {
  const { data: projects } = useProjects();

  const activeProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const pType = (p as any).project_type || 'project';
      return pType === projectType && p.status !== 'completed';
    });
  }, [projects, projectType]);

  const projectIds = useMemo(() => activeProjects.map(p => p.id), [activeProjects]);

  const { data: allSops } = useQuery({
    queryKey: ['oopsies_sops', projectType, projectIds],
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

  return { activeProjects, allSops: allSops || [] };
}

export default function OopsiesBanner({ projectType }: { projectType: 'project' | 'daily' }) {
  const [expanded, setExpanded] = useState(false);
  const { activeProjects, allSops } = useAllSopOrders(projectType);

  const oopsies = useMemo(() => {
    const messages: OopsieMessage[] = [];
    const today = new Date().toISOString().split('T')[0];
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoStr = twoMonthsAgo.toISOString().split('T')[0];

    for (const project of activeProjects) {
      const projectSops = allSops.filter(s => s.project_id === project.id);

      // Rule 1: Delivery date passed but device still pending/in_progress
      const overdueNotStarted = projectSops.filter(s =>
        s.delivery_date && s.delivery_date < today &&
        (s.preparation_status === 'pending' || s.preparation_status === 'in_progress')
      );
      if (overdueNotStarted.length > 0) {
        messages.push({
          projectId: project.id,
          customerName: project.customer_name,
          message: `${overdueNotStarted.length} Gerät(e) – Lieferdatum überschritten, Status noch „${overdueNotStarted[0].preparation_status === 'pending' ? 'Ausstehend' : 'In Bearbeitung'}"`,
          severity: 'warning',
        });
      }

      // Rule 2: Delivery date exceeded by 2+ months, project not completed
      const longOverdue = projectSops.filter(s =>
        s.delivery_date && s.delivery_date < twoMonthsAgoStr
      );
      if (longOverdue.length > 0 && project.status !== 'completed') {
        messages.push({
          projectId: project.id,
          customerName: project.customer_name,
          message: `Lieferdatum um über 2 Monate überschritten – ${projectType === 'project' ? 'Projekt' : 'Auftrag'} nicht abgeschlossen`,
          severity: 'error',
        });
      }
    }

    return messages;
  }, [activeProjects, allSops, projectType]);

  const count = oopsies.length;
  const hasIssues = count > 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
        hasIssues
          ? 'border-yellow-500/50 bg-yellow-500/10'
          : 'border-green-500/50 bg-green-500/10'
      }`}
      onClick={() => hasIssues && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          <span className="font-heading font-semibold text-sm text-foreground">
            Oopsies
          </span>
          {hasIssues && (
            <span className="bg-yellow-500 text-yellow-950 text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
              {count}
            </span>
          )}
        </div>
        {hasIssues && (
          expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {expanded && hasIssues && (
        <div className="mt-3 space-y-2">
          {oopsies.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-yellow-500 shrink-0" />
              <span className="text-foreground">
                <span className="font-semibold">{o.customerName}:</span> {o.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
