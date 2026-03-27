import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { useProjects } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { formatDate } from '@/lib/constants';
import StatusChip from '@/components/StatusChip';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle Status' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'planning', label: 'Planung' },
  { value: 'preparation', label: 'Vorbereitung' },
  { value: 'rollout_active', label: 'Rollout aktiv' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Abgebrochen' },
];

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const matchesSearch = !search || [p.customer_name, p.project_number, p.project_name]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    navigate(`/projekt/${projectId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Projektübersicht</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 font-heading text-xs">
          <Plus className="h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Kunde, Projektnummer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-heading text-xs">Kundenname</TableHead>
              <TableHead className="font-heading text-xs">Projektnummer</TableHead>
              <TableHead className="font-heading text-xs">Status</TableHead>
              <TableHead className="font-heading text-xs">Rollout-Zeitraum</TableHead>
              <TableHead className="font-heading text-xs">Erstellt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Lade Projekte...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  {projects?.length === 0
                    ? 'Noch keine Projekte vorhanden. Erstelle dein erstes Projekt!'
                    : 'Keine Projekte gefunden.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectProject(p.id)}
                >
                  <TableCell className="font-medium">{p.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.project_number || '–'}</TableCell>
                  <TableCell><StatusChip status={p.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.rollout_start || p.rollout_end
                      ? `${formatDate(p.rollout_start)} – ${formatDate(p.rollout_end)}`
                      : '–'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
