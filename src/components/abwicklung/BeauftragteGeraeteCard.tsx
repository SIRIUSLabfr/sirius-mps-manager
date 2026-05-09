import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectDevices } from '@/hooks/useProjectData';
import { useLocations } from '@/hooks/useRolloutData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Send, CheckCircle2, Package, Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
}

/** Inline-Edit-Cell mit 600ms-Debounce für freie Textfelder */
function EditCell({
  value,
  onChange,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  const handle = (v: string) => {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v !== (value ?? '')) onChange(v);
    }, 600);
  };

  return (
    <Input
      value={local}
      placeholder={placeholder}
      onChange={(e) => handle(e.target.value)}
      onBlur={() => {
        clearTimeout(timer.current);
        if (local !== (value ?? '')) onChange(local);
      }}
      className="h-7 text-xs border-transparent focus:border-primary/30 bg-transparent px-1.5"
    />
  );
}

/**
 * Mehrfach-Auswahl der Optionen (Zubehör) aus dem Kalkulations-Pool.
 * Speichert kommasepariert in soll_options. Nicht-im-Pool-Optionen
 * (manuell vorher eingetippt) bleiben erhalten und werden im Popover
 * weiter angezeigt.
 */
function OptionsMultiSelect({
  value,
  options,
  onChange,
}: {
  value: string | null | undefined;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () =>
      (value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  const allChoices = useMemo(() => {
    const set = new Set<string>(options);
    selected.forEach((s) => set.add(s));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [options, selected]);

  const toggle = (opt: string) => {
    const isSelected = selected.includes(opt);
    const next = isSelected ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join(', '));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-7 w-full flex items-center justify-between gap-1 px-1.5 text-xs rounded',
            'hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary/30',
          )}
        >
          <div className="flex flex-wrap gap-1 items-center min-w-0 flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">– keine –</span>
            ) : (
              selected.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[10px] font-normal px-1.5 py-0 h-5"
                >
                  {s}
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {allChoices.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            Keine Optionen in der Kalkulation gepflegt.
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            {allChoices.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent/40 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(opt)}
                  />
                  <span className="flex-1">{opt}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function BeauftragteGeraeteCard({ projectId }: Props) {
  const queryClient = useQueryClient();
  const { data: devices = [] } = useProjectDevices(projectId);
  const { data: locations = [] } = useLocations(projectId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Aktive Kalkulation: Quelle für Geräte-Übernahme + Zubehör-Optionen
  const { data: calc } = useQuery({
    queryKey: ['calculation_active', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('calculations')
        .select('config_json')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
  });

  /** Distinct Liste aller Zubehör-Namen aus den Kalk-Geräte-Gruppen */
  const accessoryOptions = useMemo(() => {
    const cfg: any = calc?.config_json;
    const groups = cfg?.deviceGroups || cfg?.device_groups || [];
    const set = new Set<string>();
    groups.forEach((g: any) => {
      (g.accessories || []).forEach((a: any) => {
        const name = a?.product?.name || a?.name;
        if (name) set.add(String(name));
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [calc]);

  const calcDevices = useMemo(() => {
    const cfg: any = calc?.config_json;
    const groups = cfg?.deviceGroups || cfg?.device_groups || [];
    const out: Array<{
      key: string;
      manufacturer: string;
      model: string;
      quantity: number;
      options?: string;
      label?: string;
    }> = [];
    groups.forEach((g: any, idx: number) => {
      const accNames = (g.accessories || [])
        .map((a: any) => a?.product?.name || a?.name)
        .filter(Boolean)
        .join(', ');
      out.push({
        key: g.id || `g-${idx}`,
        manufacturer: g.manufacturer || g.brand || g.mainDevice?.manufacturer || '',
        model: g.model || g.name || g.mainDevice?.name || g.mainDevice?.model || '',
        quantity: g.quantity || g.qty || g.mainQuantity || 1,
        options: accNames || undefined,
        label: g.label || undefined,
      });
    });
    return out;
  }, [calc]);

  const importable = calcDevices.length > 0;
  const hasDevices = devices.length > 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === devices.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(devices.map((d) => d.id)));
  };

  const handleAdd = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('devices').insert({
        project_id: projectId,
        soll_manufacturer: null,
        soll_model: '',
        soll_options: null,
        preparation_status: 'pending',
      } as any);
      if (error) throw error;
      refresh();
    } catch (err: any) {
      toast.error('Fehler beim Hinzufügen: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleImportFromCalc = async () => {
    setBusy(true);
    try {
      // group.label ist komma-separiert: "Filiale Nord, Filiale Süd, ..."
      // Pro Geraet wird das i-te Label verwendet, falls weniger Labels als
      // Stueckzahl: alle bekommen das letzte/erste vorhandene.
      const splitLabels = (s: string | undefined | null): string[] =>
        (s || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

      // 1. Distinct labels aus allen Geraete-Gruppen sammeln und als
      //    locations-Records anlegen, falls noch nicht existent.
      const allLabels = new Set<string>();
      calcDevices.forEach((g) => splitLabels(g.label).forEach((l) => allLabels.add(l)));
      const distinctLabels = Array.from(allLabels);

      const locByName = new Map<string, string>();
      locations.forEach((l: any) => locByName.set(String(l.name).toLowerCase(), l.id));

      const missingLabels = distinctLabels.filter(
        (l) => !locByName.has(l.toLowerCase()),
      );

      if (missingLabels.length > 0) {
        const inserts = missingLabels.map((name, idx) => ({
          project_id: projectId,
          name,
          location_type: 'site' as const,
          parent_id: null,
          sort_order: (locations.length || 0) + idx,
        }));
        const { data: newLocs, error: locErr } = await supabase
          .from('locations')
          .insert(inserts as any)
          .select();
        if (locErr) throw locErr;
        (newLocs || []).forEach((l: any) =>
          locByName.set(String(l.name).toLowerCase(), l.id),
        );
        queryClient.invalidateQueries({ queryKey: ['locations', projectId] });
      }

      // 2. Bestehende from_quote_item_ids → ID, fuer Update statt Insert.
      const existingByKey = new Map<string, string>();
      devices.forEach((d) => {
        if (d.from_quote_item_id) existingByKey.set(d.from_quote_item_id, d.id);
      });

      const inserts: any[] = [];
      const updates: Array<{ id: string; patch: Record<string, any> }> = [];

      calcDevices.forEach((g) => {
        const labels = splitLabels(g.label);
        for (let i = 1; i <= (g.quantity || 1); i++) {
          // i-tes Geraet bekommt i-ten Standort, fallback auf erstes Label
          const labelForThis = labels[i - 1] || labels[0] || '';
          const locId = labelForThis ? locByName.get(labelForThis.toLowerCase()) || null : null;
          const key = `${g.key}-${i}`;
          const fields = {
            soll_manufacturer: g.manufacturer || null,
            soll_model: g.model,
            soll_options: g.options || null,
            location_id: locId,
          };
          const existingId = existingByKey.get(key);
          if (existingId) {
            updates.push({ id: existingId, patch: fields });
          } else {
            inserts.push({
              project_id: projectId,
              ...fields,
              from_quote_item_id: key,
              preparation_status: 'pending',
            });
          }
        }
      });

      if (inserts.length === 0 && updates.length === 0 && missingLabels.length === 0) {
        toast.message('Keine Kalkulations-Geraete gefunden.');
        return;
      }

      const parts: string[] = [];
      if (missingLabels.length > 0) parts.push(`${missingLabels.length} neue(r) Standort(e)`);
      if (inserts.length > 0) parts.push(`${inserts.length} neue(s) Geraet(e)`);
      if (updates.length > 0) parts.push(`${updates.length} bestehende(s) Geraet(e) aktualisieren`);
      if (
        !confirm(
          parts.join(' + ') +
            ' anlegen / synchronisieren?' +
            (updates.length > 0
              ? '\n\nManuelle Aenderungen an Modell / Optionen / Standort der bestehenden Geraete werden ueberschrieben.'
              : ''),
        )
      ) {
        return;
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('devices').insert(inserts as any);
        if (error) throw error;
      }
      for (const u of updates) {
        const { error } = await supabase.from('devices').update(u.patch).eq('id', u.id);
        if (error) throw error;
      }

      const created = missingLabels.length > 0 ? `, ${missingLabels.length} Standort(e) angelegt` : '';
      toast.success(
        `${inserts.length} hinzugefuegt` +
          (updates.length > 0 ? `, ${updates.length} aktualisiert` : '') +
          created +
          '.',
      );
      refresh();
    } catch (err: any) {
      toast.error('Fehler beim Uebernehmen: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id: string, patch: Record<string, any>) => {
    try {
      const { error } = await supabase.from('devices').update(patch).eq('id', id);
      if (error) throw error;
      refresh();
    } catch (err: any) {
      toast.error('Speichern fehlgeschlagen: ' + (err.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Gerät wirklich entfernen?')) return;
    try {
      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) throw error;
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      refresh();
    } catch (err: any) {
      toast.error('Löschen fehlgeschlagen: ' + (err.message || err));
    }
  };

  const handleSopPush = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Bitte mindestens ein Gerät auswählen.');
      return;
    }
    const sel = devices.filter((d) => selectedIds.has(d.id));
    setBusy(true);
    try {
      const rows = sel.map((d) => ({
        project_id: projectId,
        device_id: d.id,
        manufacturer: d.soll_manufacturer || '',
        model: d.soll_model || '',
        options: d.soll_options || '',
        preparation_status: 'pending',
        delivery_status: 'pending',
      }));
      const { error: sopErr } = await supabase.from('sop_orders').insert(rows as any);
      if (sopErr) throw sopErr;
      const now = new Date().toISOString();
      const { error: devErr } = await supabase
        .from('devices')
        .update({ pushed_to_sop_at: now })
        .in('id', Array.from(selectedIds));
      if (devErr) throw devErr;
      toast.success(`${sel.length} Gerät(e) in SOP gepusht.`);
      setSelectedIds(new Set());
      refresh();
      queryClient.invalidateQueries({ queryKey: ['sop_orders', projectId] });
    } catch (err: any) {
      toast.error('SOP-Push fehlgeschlagen: ' + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Beauftragte Geräte
          {hasDevices && (
            <Badge variant="secondary" className="ml-1 text-xs font-normal">
              {devices.length}
            </Badge>
          )}
        </CardTitle>

        <div className="flex items-center gap-2">
          {importable && (
            <Button size="sm" variant="outline" onClick={handleImportFromCalc} disabled={busy}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Aus Kalkulation übernehmen
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={busy}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Gerät
          </Button>
          <Button size="sm" onClick={handleSopPush} disabled={busy || selectedIds.size === 0}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            In SOP pushen ({selectedIds.size})
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!hasDevices ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Keine Geräte erfasst.
            {importable && ' Du kannst sie aus der Kalkulation übernehmen oder manuell anlegen.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="p-2 w-10">
                  <Checkbox
                    checked={selectedIds.size === devices.length && devices.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="text-left p-2 font-heading">Modell</th>
                <th className="text-left p-2 font-heading">Optionen</th>
                <th className="text-left p-2 font-heading w-44">Standort</th>
                <th className="text-left p-2 font-heading w-20">SOP</th>
                <th className="w-10 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr
                  key={d.id}
                  className={cn(
                    'border-b last:border-b-0',
                    selectedIds.has(d.id) && 'bg-accent/30',
                  )}
                >
                  <td className="p-2">
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={() => toggle(d.id)}
                    />
                  </td>
                  <td className="p-2">
                    <EditCell
                      value={d.soll_model}
                      onChange={(v) => handleUpdate(d.id, { soll_model: v || null })}
                      placeholder="Modell"
                    />
                  </td>
                  <td className="p-2">
                    <OptionsMultiSelect
                      value={d.soll_options}
                      options={accessoryOptions}
                      onChange={(v) => handleUpdate(d.id, { soll_options: v || null })}
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={d.location_id || '__none__'}
                      onValueChange={(v) =>
                        handleUpdate(d.id, { location_id: v === '__none__' ? null : v })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="– kein Standort –" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">– kein Standort –</SelectItem>
                        {locations.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    {(d as any).pushed_to_sop_at ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        gepusht
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
