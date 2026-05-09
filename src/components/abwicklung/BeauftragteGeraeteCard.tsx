import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectDevices } from '@/hooks/useProjectData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Send, CheckCircle2, Package, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
}

/** Inline-Edit-Cell mit 600ms-Debounce auf onBlur/onChange */
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

export default function BeauftragteGeraeteCard({ projectId }: Props) {
  const queryClient = useQueryClient();
  const { data: devices = [] } = useProjectDevices(projectId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Aktive Kalkulation, um initiale Geräteübernahme anzubieten
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

  const calcDevices = useMemo(() => {
    const cfg: any = calc?.config_json;
    const groups = cfg?.deviceGroups || cfg?.device_groups || [];
    const out: Array<{ key: string; manufacturer: string; model: string; quantity: number; options?: string }> = [];
    groups.forEach((g: any, idx: number) => {
      out.push({
        key: g.id || `g-${idx}`,
        manufacturer: g.manufacturer || g.brand || g.mainDevice?.manufacturer || '',
        model: g.model || g.name || g.mainDevice?.name || g.mainDevice?.model || '',
        quantity: g.quantity || g.qty || g.mainQuantity || 1,
        options: g.options || g.label || '',
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
        soll_manufacturer: '',
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
    if (!confirm(`${calcDevices.reduce((s, g) => s + (g.quantity || 1), 0)} Geräte aus der Kalkulation übernehmen?`)) return;
    setBusy(true);
    try {
      const existingKeys = new Set(devices.map((d) => d.from_quote_item_id).filter(Boolean) as string[]);
      const inserts = calcDevices.flatMap((g) =>
        Array.from({ length: g.quantity || 1 })
          .map((_, i) => ({
            project_id: projectId,
            soll_manufacturer: g.manufacturer,
            soll_model: g.model,
            soll_options: g.options || null,
            from_quote_item_id: `${g.key}-${i + 1}`,
            preparation_status: 'pending' as const,
          }))
          .filter((d) => !existingKeys.has(d.from_quote_item_id)),
      );
      if (inserts.length === 0) {
        toast.message('Alle Kalkulations-Geräte sind bereits übernommen.');
        return;
      }
      const { error } = await supabase.from('devices').insert(inserts as any);
      if (error) throw error;
      toast.success(`${inserts.length} Gerät(e) übernommen.`);
      refresh();
    } catch (err: any) {
      toast.error('Fehler beim Übernehmen: ' + (err.message || err));
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
                <th className="text-left p-2 font-heading">Hersteller</th>
                <th className="text-left p-2 font-heading">Modell</th>
                <th className="text-left p-2 font-heading">Optionen</th>
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
                      value={d.soll_manufacturer}
                      onChange={(v) => handleUpdate(d.id, { soll_manufacturer: v || null })}
                      placeholder="Hersteller"
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
                    <EditCell
                      value={d.soll_options}
                      onChange={(v) => handleUpdate(d.id, { soll_options: v || null })}
                      placeholder="–"
                    />
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
