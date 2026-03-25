import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject, useUsers } from '@/hooks/useProjectData';
import { useActiveProject } from '@/hooks/useActiveProject';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface CustomerContact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export default function ProjectDataPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: project, isLoading } = useProject(projectId || null);
  const { data: users } = useUsers();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    customer_name: '',
    project_number: '',
    project_name: '',
    warehouse_address: '',
    project_lead: '' as string,
    technicians: [] as string[],
    customer_contacts: [] as CustomerContact[],
  });
  const [rolloutStart, setRolloutStart] = useState<Date | undefined>();
  const [rolloutEnd, setRolloutEnd] = useState<Date | undefined>();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    if (project && !initializedRef.current) {
      setForm({
        customer_name: project.customer_name || '',
        project_number: project.project_number || '',
        project_name: project.project_name || '',
        warehouse_address: project.warehouse_address || '',
        project_lead: project.project_lead || '',
        technicians: (project.technicians as string[]) || [],
        customer_contacts: (project.customer_contacts as unknown as CustomerContact[]) || [],
      });
      setRolloutStart(project.rollout_start ? new Date(project.rollout_start) : undefined);
      setRolloutEnd(project.rollout_end ? new Date(project.rollout_end) : undefined);
      initializedRef.current = true;
    }
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('projects').update(data).eq('id', projectId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Änderungen gespeichert', { duration: 2000 });
    },
    onError: (err: any) => {
      toast.error('Fehler beim Speichern: ' + err.message);
    },
  });

  const triggerAutoSave = useCallback((updatedForm: typeof form, start?: Date, end?: Date) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate({
        customer_name: updatedForm.customer_name,
        project_number: updatedForm.project_number || null,
        project_name: updatedForm.project_name || null,
        warehouse_address: updatedForm.warehouse_address || null,
        project_lead: updatedForm.project_lead || null,
        technicians: updatedForm.technicians,
        customer_contacts: updatedForm.customer_contacts,
        rollout_start: start ? format(start, 'yyyy-MM-dd') : null,
        rollout_end: end ? format(end, 'yyyy-MM-dd') : null,
      });
    }, 1000);
  }, [saveMutation, projectId]);

  const updateField = (field: string, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    triggerAutoSave(updated, rolloutStart, rolloutEnd);
  };

  const updateDate = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      setRolloutStart(date);
      triggerAutoSave(form, date, rolloutEnd);
    } else {
      setRolloutEnd(date);
      triggerAutoSave(form, rolloutStart, date);
    }
  };

  const addContact = () => {
    const updated = [...form.customer_contacts, { name: '', role: '', email: '', phone: '' }];
    updateField('customer_contacts', updated);
  };

  const removeContact = (index: number) => {
    const updated = form.customer_contacts.filter((_, i) => i !== index);
    updateField('customer_contacts', updated);
  };

  const updateContact = (index: number, field: keyof CustomerContact, value: string) => {
    const updated = form.customer_contacts.map((c, i) => i === index ? { ...c, [field]: value } : c);
    updateField('customer_contacts', updated);
  };

  if (isLoading) return <div className="text-muted-foreground py-12 text-center">Lade Projektdaten...</div>;
  if (!project) return <div className="text-muted-foreground py-12 text-center">Projekt nicht gefunden.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Projektdaten</h1>
        <span className="text-xs text-muted-foreground font-body">Auto-Save aktiv</span>
      </div>

      {/* Card: Auftraggeber & Projekt */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Auftraggeber & Projekt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kundenname *</Label>
              <Input value={form.customer_name} onChange={e => updateField('customer_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Projektnummer</Label>
              <Input value={form.project_number} onChange={e => updateField('project_number', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-heading text-xs">Projektbezeichnung</Label>
            <Input value={form.project_name} onChange={e => updateField('project_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="font-heading text-xs">Lager-Adresse</Label>
            <Input value={form.warehouse_address} onChange={e => updateField('warehouse_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading text-xs">Rollout-Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !rolloutStart && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rolloutStart ? format(rolloutStart, 'dd.MM.yyyy') : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rolloutStart} onSelect={d => updateDate('start', d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Rollout-Ende</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !rolloutEnd && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rolloutEnd ? format(rolloutEnd, 'dd.MM.yyyy') : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rolloutEnd} onSelect={d => updateDate('end', d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Beteiligte SIRIUS */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Beteiligte SIRIUS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-heading text-xs">Projektleitung</Label>
            <Select value={form.project_lead} onValueChange={v => updateField('project_lead', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Projektleiter wählen" />
              </SelectTrigger>
              <SelectContent>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email} {u.short_code ? `(${u.short_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-heading text-xs">Techniker</Label>
            <p className="text-xs text-muted-foreground">Multi-Select wird nach Anlage von Benutzern verfügbar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Card: Kundenseite */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center justify-between">
            Kundenseite – Ansprechpartner
            <Button
              variant="outline"
              size="sm"
              onClick={addContact}
              disabled={form.customer_contacts.length >= 4}
              className="gap-1 font-heading text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Hinzufügen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.customer_contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Ansprechpartner. Klicke "Hinzufügen" um einen anzulegen.</p>
          )}
          {form.customer_contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label className="font-heading text-[10px]">Name</Label>
                <Input value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div className="space-y-1">
                <Label className="font-heading text-[10px]">Rolle</Label>
                <Input value={c.role} onChange={e => updateContact(i, 'role', e.target.value)} placeholder="IT-Leiter" />
              </div>
              <div className="space-y-1">
                <Label className="font-heading text-[10px]">E-Mail</Label>
                <Input value={c.email} onChange={e => updateContact(i, 'email', e.target.value)} placeholder="max@firma.de" />
              </div>
              <div className="space-y-1">
                <Label className="font-heading text-[10px]">Telefon</Label>
                <Input value={c.phone} onChange={e => updateContact(i, 'phone', e.target.value)} placeholder="+49 123 456" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeContact(i)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
