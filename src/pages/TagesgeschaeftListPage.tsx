import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, AlertTriangle } from 'lucide-react';
import OopsiesBanner from '@/components/OopsiesBanner';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle Status' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'preparation', label: 'In Vorbereitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
  { value: 'completed', label: 'Abgeschlossen' },
];

const DAILY_STATUS_OPTIONS = [
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
  const queryClient = useQueryClient();

  useEffect(() => { setActiveProjectId(null); }, [setActiveProjectId]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessages, setWarningMessages] = useState<string[]>([]);

  const handleStatusChange = useCallback(async (projectId: string, newStatus: string) => {
    if (newStatus === 'completed') {
      const { data: sops } = await supabase
        .from('sop_orders')
        .select('preparation_status, delivery_date, end_check_date')
        .eq('project_id', projectId);

      const warnings: string[] = [];
      const today = new Date().toISOString().split('T')[0];

      if (sops && sops.length > 0) {
        const notDelivered = sops.filter(s => s.preparation_status !== 'delivered');
        if (notDelivered.length > 0) {
          warnings.push(`${notDelivered.length} Gerät(e) haben nicht den Status "Ausgeliefert".`);
        }
        const futureDelivery = sops.filter(s => s.delivery_date && s.delivery_date > today);
        if (futureDelivery.length > 0) {
          warnings.push(`${futureDelivery.length} Gerät(e) haben ein Lieferdatum in der Zukunft.`);
        }
        const futureEndCheck = sops.filter(s => s.end_check_date && s.end_check_date > today);
        if (futureEndCheck.length > 0) {
          warnings.push(`${futureEndCheck.length} Gerät(e) haben ein Endkontrolldatum in der Zukunft.`);
        }
      }

      if (warnings.length > 0) {
        setWarningMessages(warnings);
        setWarningOpen(true);
        return;
      }
    }

    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
    if (error) {
      toast.error('Status konnte nicht geändert werden');
    } else {
      toast.success('Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  }, [queryClient]);

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
      <OopsiesBanner projectType="daily" />
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
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Select value={p.status} onValueChange={v => handleStatusChange(p.id, v)}>
                      <SelectTrigger className="h-7 w-[150px] text-xs border-none bg-transparent hover:bg-muted/50 px-1">
                        <StatusChip status={p.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {DAILY_STATUS_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
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

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Auftrag kann nicht abgeschlossen werden
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Folgende Kriterien sind nicht erfüllt:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {warningMessages.map((msg, i) => (
                    <li key={i} className="text-sm">{msg}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Verstanden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
