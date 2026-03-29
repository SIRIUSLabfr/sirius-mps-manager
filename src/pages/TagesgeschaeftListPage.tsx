import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Printer } from 'lucide-react';
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
  { value: 'preparation', label: 'In Vorbereitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
  { value: 'completed', label: 'Abgeschlossen' },
];

export default function TagesgeschaeftListPage() {
  const { data: projects, isLoading } = useProjects();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();

  useEffect(() => { setActiveProjectId(null); }, [setActiveProjectId]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => {
      const pType = (p as any).project_type || 'project';
      if (pType !== 'daily') return false;
      const matchesSearch = !search || [p.customer_name, p.project_number, p.logistics_notes]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const handleSelect = (project: any) => {
    setActiveProjectId(project.id);
    navigate(`/projekt/${project.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Tagesgeschäft</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 font-heading text-xs">
          <Plus className="h-4 w-4" />
          Neues Tagesgeschäft
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suche nach Kunde, Auftragsnr..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-heading text-xs">Kunde</TableHead>
              <TableHead className="font-heading text-xs">Auftrag-Nr</TableHead>
              <TableHead className="font-heading text-xs">Status</TableHead>
              <TableHead className="font-heading text-xs">Liefertermin</TableHead>
              <TableHead className="font-heading text-xs">Notiz</TableHead>
              <TableHead className="font-heading text-xs">Erstellt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Lade Aufträge...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Keine Tagesgeschäft-Aufträge gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSelect(p)}>
                  <TableCell className="font-medium">{p.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.project_number || '–'}</TableCell>
                  <TableCell><StatusChip status={p.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(p.rollout_start)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.logistics_notes || '–'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultType="daily" />
    </div>
  );
}
