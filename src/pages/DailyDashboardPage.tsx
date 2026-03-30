import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import StatusChip from '@/components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calculator, Wrench, Calendar, AlertCircle, Plus, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAILY_STATUSES = [
  { value: 'draft', label: 'Entwurf' },
  { value: 'preparation', label: 'In Vorbereitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
  { value: 'completed', label: 'Abgeschlossen' },
];

const DEVICE_STATUSES = [
  { value: 'pending', label: 'Ausstehend' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
  { value: 'checked', label: 'Geprüft' },
];

export default function DailyDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: devices } = useProjectDevices(projectId || null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ manufacturer: '', model: '', serial: '', options: '' });
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const contacts = useMemo(() => {
    if (!project?.customer_contacts) return [];
    return (project.customer_contacts as any[]) || [];
  }, [project]);

  const handleInlineUpdate = async (field: string, value: any) => {
    if (!projectId) return;
    const { error } = await supabase.from('projects').update({ [field]: value } as any).eq('id', projectId);
    if (error) toast.error('Fehler beim Speichern');
    else queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  const handleAddDevice = async () => {
    if (!projectId) return;
    const { error } = await supabase.from('devices').insert({
      project_id: projectId,
      soll_manufacturer: newDevice.manufacturer || null,
      soll_model: newDevice.model || null,
      soll_serial: newDevice.serial || null,
      soll_options: newDevice.options || null,
    });
    if (error) { toast.error('Fehler: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
    toast.success('Gerät hinzugefügt');
    setNewDevice({ manufacturer: '', model: '', serial: '', options: '' });
    setAddDeviceOpen(false);
  };

  const handleDeviceStatusChange = async (deviceId: string, status: string) => {
    const { error } = await supabase.from('devices').update({ preparation_status: status }).eq('id', deviceId);
    if (error) toast.error('Fehler');
    else queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
  };

  const handleConvertToProject = async () => {
    if (!projectId) return;
    const { error } = await supabase.from('projects').update({ project_type: 'project' } as any).eq('id', projectId);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    toast.success('In MPS-Projekt umgewandelt');
    setConvertDialogOpen(false);
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></div>;
  }
  if (!project) {
    return (
      <div className="py-16 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">Auftrag nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">{project.customer_name}</h1>
        <div className="flex gap-2">
          <Select value={project.status} onValueChange={(v) => handleInlineUpdate('status', v)}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAILY_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setConvertDialogOpen(true)}>
            <ArrowRightLeft className="h-3.5 w-3.5" /> In Projekt umwandeln
          </Button>
        </div>
      </div>

      {/* Auftragsdaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Auftragsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Auftragsnummer</p>
              <p className="font-medium">{project.project_number || '–'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Ansprechpartner</p>
              <p className="font-medium">
                {contacts[0]?.name || '–'}
                {contacts[0]?.phone && <span className="text-muted-foreground ml-2">{contacts[0].phone}</span>}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Lieferadresse</p>
              <p className="font-medium">{project.warehouse_address || '–'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Liefertermin</p>
              <p className="font-medium">
                {project.rollout_start ? format(new Date(project.rollout_start), 'dd.MM.yyyy') : '–'}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Kurznotiz</p>
              <p className="font-medium">{project.logistics_notes || '–'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          icon={<Calculator className="h-10 w-10 text-primary" />}
          title="Kalkulation starten"
          description="Geräte kalkulieren und Angebot berechnen"
          onClick={() => navigate(`/projekt/${projectId}/kalkulation`)}
        />
        <QuickAction
          icon={<Wrench className="h-10 w-10 text-primary" />}
          title="SOP erstellen"
          description="Serviceauftrag für Vorbereitung anlegen"
          onClick={() => navigate(`/projekt/${projectId}/sop`)}
        />
        <QuickAction
          icon={<Calendar className="h-10 w-10 text-primary" />}
          title="Im Kalender planen"
          description="Liefertermin im Kalender einplanen"
          onClick={() => navigate(`/projekt/${projectId}/kalender`)}
        />
      </div>

      {/* Geräte */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base">Geräte ({devices?.length || 0})</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddDeviceOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Gerät hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!devices || devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Noch keine Geräte. Füge ein Gerät hinzu oder starte die Kalkulation.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-heading text-xs">Hersteller</TableHead>
                  <TableHead className="font-heading text-xs">Modell</TableHead>
                  <TableHead className="font-heading text-xs">Seriennummer</TableHead>
                  <TableHead className="font-heading text-xs">Optionen</TableHead>
                  <TableHead className="font-heading text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.soll_manufacturer || '–'}</TableCell>
                    <TableCell className="text-sm font-medium">{d.soll_model || '–'}</TableCell>
                    <TableCell className="text-sm font-mono">{d.soll_serial || '–'}</TableCell>
                    <TableCell className="text-sm">{d.soll_options || '–'}</TableCell>
                    <TableCell>
                      <Select value={d.preparation_status} onValueChange={(v) => handleDeviceStatusChange(d.id, v)}>
                        <SelectTrigger className="h-7 text-[11px] w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="font-heading">Gerät hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs font-heading">Hersteller</Label><Input value={newDevice.manufacturer} onChange={e => setNewDevice(d => ({ ...d, manufacturer: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs font-heading">Modell</Label><Input value={newDevice.model} onChange={e => setNewDevice(d => ({ ...d, model: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs font-heading">Seriennummer</Label><Input value={newDevice.serial} onChange={e => setNewDevice(d => ({ ...d, serial: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs font-heading">Optionen / Zubehör</Label><Input value={newDevice.options} onChange={e => setNewDevice(d => ({ ...d, options: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeviceOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddDevice}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">In MPS-Projekt umwandeln?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchtest du diesen Auftrag in ein vollständiges MPS-Projekt umwandeln? Die zusätzlichen Module
            (Analyse, Konzept, Rollout-Planung) werden freigeschaltet. Alle bestehenden Daten bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleConvertToProject}>Umwandeln</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickAction({ icon, title, description, onClick }: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center text-center py-6 gap-2">
        {icon}
        <p className="font-heading font-bold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
