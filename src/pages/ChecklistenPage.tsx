import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useChecklists } from '@/hooks/useChecklistData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateInputString } from '@/components/ui/date-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, MinusCircle, Plus, ClipboardList } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface CheckItem {
  key: string;
  label: string;
  status: 'open' | 'done' | 'not_needed';
  note: string;
}

const IT_WALKTHROUGH_DEFAULTS: Omit<CheckItem, 'key'>[] = [
  { label: 'Lagepläne', status: 'open', note: '' },
  { label: 'Vertragsunterlagen', status: 'open', note: '' },
  { label: 'Netzwerkdosen geprüft', status: 'open', note: '' },
  { label: 'Strom am Stellplatz vorhanden', status: 'open', note: '' },
  { label: 'IP-Adressen zugeteilt', status: 'open', note: '' },
  { label: 'Firewallfreigaben erteilt', status: 'open', note: '' },
  { label: 'Scan-Ziele eingerichtet', status: 'open', note: '' },
  { label: 'Treiber bereitgestellt', status: 'open', note: '' },
  { label: 'Stellplätze vermessen', status: 'open', note: '' },
];

const PRE_ROLLOUT_DEFAULTS: Omit<CheckItem, 'key'>[] = [
  { label: 'Alle Geräte vorgerichtet?', status: 'open', note: '' },
  { label: 'Verbrauchsmaterial vollständig?', status: 'open', note: '' },
  { label: 'Fahrzeuge reserviert?', status: 'open', note: '' },
  { label: 'Kunde über Termin informiert?', status: 'open', note: '' },
  { label: 'Alte Geräte inventarisiert?', status: 'open', note: '' },
  { label: 'Netzwerk-Einstellungen vorbereitet?', status: 'open', note: '' },
  { label: 'Einweisungsmaterial vorbereitet?', status: 'open', note: '' },
];

function makeItems(defaults: Omit<CheckItem, 'key'>[]): CheckItem[] {
  return defaults.map((d, i) => ({ ...d, key: `item_${i}` }));
}

export default function ChecklistenPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: checklists } = useChecklists(projectId || null);
  const queryClient = useQueryClient();

  useEffect(() => { if (projectId) setActiveProjectId(projectId); }, [projectId, setActiveProjectId]);

  // Find or initialize checklists
  const itChecklist = checklists?.find(c => c.checklist_type === 'it_walkthrough');
  const preChecklist = checklists?.find(c => c.checklist_type === 'pre_rollout');

  const initChecklist = async (type: string, defaults: Omit<CheckItem, 'key'>[]) => {
    if (!projectId) return;
    const { error } = await supabase.from('checklists').insert({
      project_id: projectId,
      checklist_type: type,
      items: makeItems(defaults) as any,
    });
    if (error) toast.error('Fehler: ' + error.message);
    else queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
  };

  // Compute overall progress
  const allItems = [
    ...((itChecklist?.items as any as CheckItem[]) || []),
    ...((preChecklist?.items as any as CheckItem[]) || []),
  ];
  const totalItems = allItems.length;
  const doneItems = allItems.filter(i => i.status === 'done' || i.status === 'not_needed').length;
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Checklisten</h1>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <ClipboardList className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-heading font-semibold">Gesamtfortschritt</span>
                <span className="text-xs font-heading font-bold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{doneItems}/{totalItems} erledigt</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="it_walkthrough">
        <TabsList className="font-heading">
          <TabsTrigger value="it_walkthrough" className="text-xs">IT-Begehung</TabsTrigger>
          <TabsTrigger value="pre_rollout" className="text-xs">Pre-Rollout</TabsTrigger>
        </TabsList>

        <TabsContent value="it_walkthrough" className="mt-4">
          {itChecklist ? (
            <ChecklistCard checklist={itChecklist} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['checklists', projectId] })} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">IT-Begehung Checkliste noch nicht erstellt.</p>
                <Button onClick={() => initChecklist('it_walkthrough', IT_WALKTHROUGH_DEFAULTS)} className="gap-1.5 font-heading text-xs">
                  <Plus className="h-3.5 w-3.5" /> IT-Begehung Checkliste erstellen
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pre_rollout" className="mt-4">
          {preChecklist ? (
            <ChecklistCard checklist={preChecklist} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['checklists', projectId] })} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">Pre-Rollout Checkliste noch nicht erstellt.</p>
                <Button onClick={() => initChecklist('pre_rollout', PRE_ROLLOUT_DEFAULTS)} className="gap-1.5 font-heading text-xs">
                  <Plus className="h-3.5 w-3.5" /> Pre-Rollout Checkliste erstellen
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistCard({ checklist, onUpdated }: { checklist: Tables<'checklists'>; onUpdated: () => void }) {
  const items = (checklist.items as any as CheckItem[]) || [];
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const saveChecklist = useCallback(async (updates: Partial<Tables<'checklists'>>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from('checklists').update(updates).eq('id', checklist.id);
      if (error) toast.error('Speichern fehlgeschlagen');
      else onUpdated();
    }, 600);
  }, [checklist.id, onUpdated]);

  const updateItem = (key: string, field: keyof CheckItem, value: string) => {
    const updated = items.map(i => i.key === key ? { ...i, [field]: value } : i);
    saveChecklist({ items: updated as any });
  };

  const addItem = () => {
    const newItem: CheckItem = { key: `custom_${Date.now()}`, label: 'Neuer Prüfpunkt', status: 'open', note: '' };
    const updated = [...items, newItem];
    saveChecklist({ items: updated as any });
  };

  const doneCount = items.filter(i => i.status === 'done' || i.status === 'not_needed').length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base">
            {checklist.checklist_type === 'it_walkthrough' ? 'IT-Begehung' : 'Pre-Rollout'}
          </CardTitle>
          <span className="text-xs font-heading font-bold text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-heading">Begehungsdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left text-sm h-9', !checklist.walkthrough_date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {checklist.walkthrough_date ? format(new Date(checklist.walkthrough_date), 'dd.MM.yyyy') : 'Datum wählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checklist.walkthrough_date ? new Date(checklist.walkthrough_date) : undefined}
                  onSelect={d => saveChecklist({ walkthrough_date: d ? format(d, 'yyyy-MM-dd') : null })}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-heading">Teilnehmer</Label>
            <Input defaultValue={checklist.participants || ''} onChange={e => saveChecklist({ participants: e.target.value || null })} className="text-sm h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-heading">Notizen</Label>
            <Textarea defaultValue={checklist.notes || ''} onChange={e => saveChecklist({ notes: e.target.value || null })} className="text-sm min-h-[36px]" />
          </div>
        </div>

        {/* Items */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Prüfpunkt</span>
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground text-center w-24">Vorhanden</span>
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground text-center w-24">Nicht nötig</span>
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground text-center w-24">Offen</span>
          </div>
          <div className="divide-y divide-border/50">
            {items.map(item => (
              <div key={item.key} className={cn(
                'grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-2.5 items-center transition-colors',
                item.status === 'done' && 'bg-emerald-50/30',
                item.status === 'not_needed' && 'bg-muted/20',
              )}>
                <div className="space-y-1 pr-4">
                  {item.key.startsWith('custom_') ? (
                    <Input
                      defaultValue={item.label}
                      onChange={e => updateItem(item.key, 'label', e.target.value)}
                      className="text-sm h-7 font-medium border-dashed"
                    />
                  ) : (
                    <span className="text-sm font-body font-medium">{item.label}</span>
                  )}
                  <Input
                    placeholder="Notiz..."
                    defaultValue={item.note}
                    onChange={e => updateItem(item.key, 'note', e.target.value)}
                    className="text-[11px] h-6 text-muted-foreground border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:bg-muted/30 rounded"
                  />
                </div>
                <button onClick={() => updateItem(item.key, 'status', 'done')} className="w-24 flex justify-center">
                  <CheckCircle2 className={cn('h-5 w-5 transition-colors', item.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground/20 hover:text-emerald-300')} />
                </button>
                <button onClick={() => updateItem(item.key, 'status', 'not_needed')} className="w-24 flex justify-center">
                  <MinusCircle className={cn('h-5 w-5 transition-colors', item.status === 'not_needed' ? 'text-muted-foreground' : 'text-muted-foreground/20 hover:text-muted-foreground/50')} />
                </button>
                <button onClick={() => updateItem(item.key, 'status', 'open')} className="w-24 flex justify-center">
                  <Circle className={cn('h-5 w-5 transition-colors', item.status === 'open' ? 'text-amber-500' : 'text-muted-foreground/20 hover:text-amber-300')} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs font-heading">
          <Plus className="h-3.5 w-3.5" /> Prüfpunkt hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
}
