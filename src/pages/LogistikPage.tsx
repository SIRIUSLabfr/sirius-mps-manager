import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime } from '@/hooks/useRolloutData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateInputString } from '@/components/ui/date-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Truck, ChevronDown, Trash2, Package } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const VEHICLE_TYPES = ['Sprinter', 'Transporter', 'PKW'];

interface VehicleEntry { type: string; count: number; }

export default function LogistikPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const queryClient = useQueryClient();
  const { data: devices } = useDevicesRealtime(projectId || null);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => { if (projectId) setActiveProjectId(projectId); }, [projectId, setActiveProjectId]);

  const { data: logistics } = useQuery({
    queryKey: ['rollout_logistics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.from('rollout_logistics').select('*').eq('project_id', projectId).order('rollout_day');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const addDay = async () => {
    if (!projectId) return;
    const nextDay = (logistics?.length || 0) + 1;
    const { data, error } = await supabase.from('rollout_logistics').insert({ project_id: projectId, rollout_day: nextDay }).select('id').single();
    if (error) { toast.error('Fehler: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['rollout_logistics', projectId] });
    setExpandedDay(data.id);
    toast.success(`Rollout-Tag ${nextDay} hinzugefügt`);
  };

  const deleteDay = async (id: string) => {
    const { error } = await supabase.from('rollout_logistics').delete().eq('id', id);
    if (error) toast.error('Fehler');
    else {
      queryClient.invalidateQueries({ queryKey: ['rollout_logistics', projectId] });
      toast.success('Tag gelöscht');
    }
  };

  const getDevicesForDay = (dayNum: number) => devices?.filter(d => d.rollout_day === dayNum) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Logistik</h1>
        <Button size="sm" className="gap-1.5 text-xs font-heading" onClick={addDay}>
          <Plus className="h-3.5 w-3.5" /> Rollout-Tag hinzufügen
        </Button>
      </div>

      {(!logistics || logistics.length === 0) ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Truck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Noch keine Rollout-Tage angelegt.</p>
              <Button variant="outline" size="sm" onClick={addDay} className="gap-1.5 text-xs font-heading">
                <Plus className="h-3.5 w-3.5" /> Ersten Rollout-Tag anlegen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logistics.map(day => (
            <DayCard
              key={day.id}
              day={day}
              expanded={expandedDay === day.id}
              onToggle={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
              onDelete={() => deleteDay(day.id)}
              devices={getDevicesForDay(day.rollout_day)}
              projectId={projectId!}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['rollout_logistics', projectId] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({ day, expanded, onToggle, onDelete, devices, projectId, onUpdated }: {
  day: Tables<'rollout_logistics'>;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  devices: Tables<'devices'>[];
  projectId: string;
  onUpdated: () => void;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [vehicles, setVehicles] = useState<VehicleEntry[]>(() => {
    const v = day.vehicles as any;
    return Array.isArray(v) ? v : [];
  });

  const save = useCallback((field: string, value: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from('rollout_logistics').update({ [field]: value }).eq('id', day.id);
      if (error) toast.error('Speichern fehlgeschlagen');
      else onUpdated();
    }, 800);
  }, [day.id, onUpdated]);

  const addVehicle = () => {
    const updated = [...vehicles, { type: 'Sprinter', count: 1 }];
    setVehicles(updated);
    save('vehicles', updated);
  };

  const updateVehicle = (idx: number, field: keyof VehicleEntry, value: any) => {
    const updated = vehicles.map((v, i) => i === idx ? { ...v, [field]: value } : v);
    setVehicles(updated);
    save('vehicles', updated);
  };

  const removeVehicle = (idx: number) => {
    const updated = vehicles.filter((_, i) => i !== idx);
    setVehicles(updated);
    save('vehicles', updated);
  };

  const vehicleSummary = vehicles.map(v => `${v.count}× ${v.type}`).join(', ') || 'Keine';

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-heading font-extrabold text-primary text-lg">{day.rollout_day}</span>
                </div>
                <div>
                  <CardTitle className="font-heading text-base">
                    Tag {day.rollout_day}
                    {day.date && <span className="text-muted-foreground font-normal ml-2">– {format(new Date(day.date), 'dd.MM.yyyy', { locale: de })}</span>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {devices.length} Geräte · Fahrzeuge: {vehicleSummary}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{devices.length} Geräte</Badge>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Day Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Datum</Label>
                <DateInputString
                  value={day.date}
                  onChange={v => save('date', v)}
                  size="sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">Abfahrtszeit</Label>
                <Input defaultValue={day.departure_time || ''} type="time" onChange={e => save('departure_time', e.target.value || null)} className="text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">Sammelstelle</Label>
                <Input defaultValue={day.collection_point || ''} onChange={e => save('collection_point', e.target.value || null)} className="text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">Tages-Ansprechpartner</Label>
                <Input defaultValue={day.daily_contact || ''} onChange={e => save('daily_contact', e.target.value || null)} className="text-sm h-9" />
              </div>
            </div>

            {/* Vehicles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-heading uppercase tracking-widest text-muted-foreground">Fahrzeuge</Label>
                <Button variant="ghost" size="sm" onClick={addVehicle} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Fahrzeug
                </Button>
              </div>
              {vehicles.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Noch keine Fahrzeuge angelegt</p>
              ) : (
                <div className="space-y-2">
                  {vehicles.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={v.type} onValueChange={val => updateVehicle(idx, 'type', val)}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={1} value={v.count} onChange={e => updateVehicle(idx, 'count', parseInt(e.target.value) || 1)} className="w-20 h-8 text-xs" />
                      <Button variant="ghost" size="icon" onClick={() => removeVehicle(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Text fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Sicherheitsunterweisung</Label>
                <Textarea defaultValue={day.safety_instructions || ''} onChange={e => save('safety_instructions', e.target.value || null)} className="text-sm min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">Hygienevorgaben</Label>
                <Textarea defaultValue={day.hygiene_requirements || ''} onChange={e => save('hygiene_requirements', e.target.value || null)} className="text-sm min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">Transport-Notizen</Label>
                <Textarea defaultValue={day.transport_notes || ''} onChange={e => save('transport_notes', e.target.value || null)} className="text-sm min-h-[60px]" />
              </div>
            </div>

            {/* Devices for this day */}
            <div className="space-y-2">
              <Label className="text-xs font-heading uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Geräte dieses Tages ({devices.length})
              </Label>
              {devices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Keine Geräte diesem Tag zugewiesen. Weise Geräte über die Rolloutliste zu (Spalte "Rollout-Tag").</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-3 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Nr</th>
                        <th className="px-3 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Modell</th>
                        <th className="px-3 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Hersteller</th>
                        <th className="px-3 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {devices.map(d => (
                        <tr key={d.id} className="hover:bg-muted/10">
                          <td className="px-3 py-1.5 font-mono">{d.device_number}</td>
                          <td className="px-3 py-1.5 font-medium">{d.soll_model || d.ist_model || '–'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{d.soll_manufacturer || d.ist_manufacturer || '–'}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant={d.preparation_status === 'prepared' ? 'default' : 'secondary'} className="text-[10px]">
                              {d.preparation_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Tag löschen
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
