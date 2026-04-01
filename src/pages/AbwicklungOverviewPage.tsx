import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjectData';
import { useAllOrderProcessing } from '@/hooks/useOrderProcessing';
import { useActiveProject } from '@/hooks/useActiveProject';
import { getGroupsForType, countSteps } from '@/lib/orderProcessingConfig';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Package, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_OPTIONS } from '@/lib/orderProcessingConfig';
import { useState } from 'react';

export default function AbwicklungOverviewPage() {
  const { data: projects } = useProjects();
  const { data: allProcessing } = useAllOrderProcessing();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState('alle');
  const [typeFilter, setTypeFilter] = useState('alle');

  const rows = useMemo(() => {
    if (!allProcessing || !projects) return [];
    return allProcessing.map(op => {
      const proj = projects.find(p => p.id === op.project_id);
      if (!proj) return null;
      const pt = (proj as any).project_type || 'project';
      const groups = getGroupsForType(pt);
      const { total, done } = countSteps(op.steps, groups);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      // Find next open step
      let nextStep = '';
      for (const g of groups) {
        const gs = op.steps?.[g.key] || {};
        for (const s of g.steps) {
          if (!gs[s.key]?.done) {
            nextStep = s.label;
            break;
          }
        }
        if (nextStep) break;
      }

      return {
        id: op.id,
        projectId: proj.id,
        type: pt,
        customer: proj.customer_name,
        projectName: proj.project_name || proj.project_number || '',
        status: op.status || 'offen',
        pct,
        done,
        total,
        nextStep,
      };
    }).filter(Boolean) as any[];
  }, [allProcessing, projects]);

  const filtered = rows.filter(r => {
    if (statusFilter !== 'alle' && r.status !== statusFilter) return false;
    if (typeFilter !== 'alle' && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-xl font-bold">Abwicklung – Übersicht</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Typen</SelectItem>
            <SelectItem value="project">Projekte</SelectItem>
            <SelectItem value="daily">Tagesgeschäft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-heading text-xs font-semibold">Typ</th>
                <th className="text-left p-3 font-heading text-xs font-semibold">Kunde</th>
                <th className="text-left p-3 font-heading text-xs font-semibold">Auftrag</th>
                <th className="text-left p-3 font-heading text-xs font-semibold">Status</th>
                <th className="text-left p-3 font-heading text-xs font-semibold w-48">Fortschritt</th>
                <th className="text-left p-3 font-heading text-xs font-semibold">Nächster Schritt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Abwicklungen vorhanden</td></tr>
              )}
              {filtered.map(r => {
                const st = STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];
                return (
                  <tr
                    key={r.id}
                    className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setActiveProjectId(r.projectId);
                      navigate(`/projekt/${r.projectId}/abwicklung`);
                    }}
                  >
                    <td className="p-3">
                      {r.type === 'project' ? <Package className="h-4 w-4 text-primary" /> : <Printer className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="p-3 font-medium">{r.customer}</td>
                    <td className="p-3 text-muted-foreground">{r.projectName}</td>
                    <td className="p-3">
                      <Badge className={cn('text-xs', st.color)} variant="secondary">{st.label}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${r.pct}%`,
                              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))',
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{r.pct}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{r.nextStep || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
