import { useState, useCallback } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProjectDevices, useProject } from '@/hooks/useProjectData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Download, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUSES = [
  { value: 'pending', label: 'Ausstehend' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
  { value: 'checked', label: 'Geprüft' },
];

export default function DailyGeraeteListePage() {
  const { activeProjectId } = useActiveProject();
  const { data: devices } = useProjectDevices(activeProjectId);
  const { data: project } = useProject(activeProjectId);
  const queryClient = useQueryClient();

  // Load calculations for "from calc" import
  const { data: calcs } = useQuery({
    queryKey: ['calculations_all', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data } = await supabase.from('calculations').select('*').eq('project_id', activeProjectId).order('created_at');
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const addDevice = async () => {
    if (!activeProjectId) return;
    const { error } = await supabase.from('devices').insert({ project_id: activeProjectId });
    if (error) toast.error('Fehler');
    else queryClient.invalidateQueries({ queryKey: ['devices', activeProjectId] });
  };

  const updateField = useCallback(async (deviceId: string, field: string, value: string) => {
    const { error } = await supabase.from('devices').update({ [field]: value || null } as any).eq('id', deviceId);
    if (error) toast.error('Fehler');
    else queryClient.invalidateQueries({ queryKey: ['devices', activeProjectId] });
  }, [activeProjectId, queryClient]);

  const importFromCalc = async () => {
    if (!activeProjectId || !calcs?.length) { toast.error('Keine Kalkulation vorhanden'); return; }
    const active = calcs.find((c: any) => c.is_active) || calcs[0];
    const cfg = (active.config_json as any) || {};
    const groups = cfg.device_groups || cfg.deviceGroups || [];
    if (!groups.length) { toast.error('Keine Gerätegruppen in der Kalkulation'); return; }

    const inserts = groups.flatMap((g: any) => {
      const count = g.mainQuantity || 1;
      return Array.from({ length: count }, () => ({
        project_id: activeProjectId,
        soll_manufacturer: g.mainDevice?.manufacturer || null,
        soll_model: g.mainDevice?.name || g.mainDevice?.model || null,
        soll_building: g.label || null,
      }));
    });

    const { error } = await supabase.from('devices').insert(inserts);
    if (error) toast.error('Fehler: ' + error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['devices', activeProjectId] });
      toast.success(`${inserts.length} Geräte aus Kalkulation übernommen`);
    }
  };

  const exportExcel = () => {
    if (!devices?.length) return;
    const rows = devices.map(d => ({
      Hersteller: d.soll_manufacturer || '',
      Modell: d.soll_model || '',
      Seriennummer: d.soll_serial || '',
      'Geräte-ID': d.soll_device_id || '',
      'Optionen/Zubehör': d.soll_options || '',
      Lieferadresse: d.soll_building || '',
      Status: d.preparation_status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Geräte');
    XLSX.writeFile(wb, `Geräteliste_${project?.customer_name || 'Export'}.xlsx`);
  };

  if (!activeProjectId) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Wähle zuerst einen Auftrag.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Geräteliste</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={importFromCalc}>
            <Package className="h-3.5 w-3.5" /> Aus Kalkulation
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportExcel}>
            <Download className="h-3.5 w-3.5" /> Excel-Export
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={addDevice}>
            <Plus className="h-3.5 w-3.5" /> Gerät hinzufügen
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-heading text-xs">Hersteller</TableHead>
                <TableHead className="font-heading text-xs">Modell</TableHead>
                <TableHead className="font-heading text-xs">Seriennummer</TableHead>
                <TableHead className="font-heading text-xs">Geräte-ID</TableHead>
                <TableHead className="font-heading text-xs">Optionen/Zubehör</TableHead>
                <TableHead className="font-heading text-xs">Lieferadresse</TableHead>
                <TableHead className="font-heading text-xs w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!devices || devices.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-sm">
                    Noch keine Geräte. Klicke "+ Gerät hinzufügen" oder importiere aus der Kalkulation.
                  </TableCell>
                </TableRow>
              ) : devices.map(d => (
                <TableRow key={d.id}>
                  <TableCell><EditableField value={d.soll_manufacturer || ''} onSave={v => updateField(d.id, 'soll_manufacturer', v)} /></TableCell>
                  <TableCell><EditableField value={d.soll_model || ''} onSave={v => updateField(d.id, 'soll_model', v)} /></TableCell>
                  <TableCell><EditableField value={d.soll_serial || ''} onSave={v => updateField(d.id, 'soll_serial', v)} className="font-mono" /></TableCell>
                  <TableCell><EditableField value={d.soll_device_id || ''} onSave={v => updateField(d.id, 'soll_device_id', v)} /></TableCell>
                  <TableCell><EditableField value={d.soll_options || ''} onSave={v => updateField(d.id, 'soll_options', v)} /></TableCell>
                  <TableCell><EditableField value={d.soll_building || ''} onSave={v => updateField(d.id, 'soll_building', v)} /></TableCell>
                  <TableCell>
                    <Select value={d.preparation_status} onValueChange={v => updateField(d.id, 'preparation_status', v)}>
                      <SelectTrigger className="h-7 text-[11px] w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditableField({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); if (val !== value) onSave(val); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); if (val !== value) onSave(val); } if (e.key === 'Escape') { setEditing(false); setVal(value); } }}
        className={`h-7 text-xs ${className || ''}`}
      />
    );
  }
  return (
    <span
      className={`text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded min-h-[28px] inline-block ${className || ''}`}
      onClick={() => { setVal(value); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground/40">–</span>}
    </span>
  );
}
