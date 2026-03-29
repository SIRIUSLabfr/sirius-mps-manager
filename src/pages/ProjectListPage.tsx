import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Package, Printer } from 'lucide-react';
import { useProjects } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { formatDate } from '@/lib/constants';
import StatusChip from '@/components/StatusChip';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const TYPE_OPTIONS = [
  { value: 'all', label: 'Alle Typen' },
  { value: 'project', label: 'MPS-Projekte' },
  { value: 'daily', label: 'Tagesgeschäft' },
];

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();

  useEffect(() => { setActiveProjectId(null); }, [setActiveProjectId]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const matchesSearch = !search || [p.customer_name, p.project_number, p.project_name]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const pType = (p as any).project_type || 'project';
      const matchesType = typeFilter === 'all' || pType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [projects, search, statusFilter, typeFilter]);

  const handleSelectProject = (project: any) => {
    setActiveProjectId(project.id);
    const pType = project.project_type || 'project';
    if (pType === 'daily') {
      navigate(`/projekt/${project.id}/daily`);
    } else {
      navigate(`/projekt/${project.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Projektübersicht</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 font-heading text-xs">
          <Plus className="h-4 w-4" />
          Neuer Vorgang
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Kunde, Projektnummer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead className="font-heading text-xs w-16">Typ</TableHead>
              <TableHead className="font-heading text-xs">Kundenname</TableHead>
              <TableHead className="font-heading text-xs">Projektnummer</TableHead>
              <TableHead className="font-heading text-xs">Status</TableHead>
              <TableHead className="font-heading text-xs">Zeitraum</TableHead>
              <TableHead className="font-heading text-xs">Erstellt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Lade Projekte...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {projects?.length === 0
                    ? 'Noch keine Projekte vorhanden. Erstelle deinen ersten Vorgang!'
                    : 'Keine Projekte gefunden.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(p => {
                const pType = (p as any).project_type || 'project';
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectProject(p)}
                  >
                    <TableCell>
                      {pType === 'daily' ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-orange-300 text-orange-600">
                          <Printer className="h-3 w-3" /> Tagesgeschäft
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                          <Package className="h-3 w-3" /> Projekt
                        </Badge>
                      )}
                    </TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
