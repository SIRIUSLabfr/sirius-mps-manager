import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime, useLocations } from '@/hooks/useRolloutData';
import EditableCell from '@/components/rollout/EditableCell';
import FinalCheckChip from '@/components/rollout/FinalCheckChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Download, Printer, Search, ArrowUpDown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceUpdate = Database['public']['Tables']['devices']['Update'];

const OPTIMIZATION_OPTIONS = [
  { value: 'OneToOne', label: 'OneToOne' },
  { value: 'Umzug', label: 'Umzug' },
  { value: 'Keep', label: 'Keep' },
  { value: 'Neuaufstellung', label: 'Neuaufstellung' },
  { value: 'Nicht im Projekt', label: 'Nicht im Projekt' },
  { value: 'Abbau', label: 'Abbau' },
];

type SortKey = string;
type SortDir = 'asc' | 'desc';

export default function RolloutListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: devices, isLoading } = useDevicesRealtime(projectId || null);
  const { data: locations } = useLocations(projectId || null);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('device_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const locationMap = useMemo(() => {
    const m: Record<string, string> = {};
    locations?.forEach(l => { m[l.id] = l.name; });
    return m;
  }, [locations]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DeviceUpdate }) => {
      const { error } = await supabase.from('devices').update(data).eq('id', id);
      if (error) throw error;
    },
    onError: (err: any) => toast.error('Speicherfehler: ' + err.message),
  });

  const debouncedUpdate = useCallback((deviceId: string, field: string, value: any) => {
    const key = `${deviceId}-${field}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      updateMutation.mutate({ id: deviceId, data: { [field]: value } as DeviceUpdate });
    }, 600);
  }, [updateMutation]);

  const addDevice = async () => {
    if (!projectId) return;
    const maxNum = devices?.reduce((max, d) => Math.max(max, d.device_number || 0), 0) || 0;
    const { error } = await supabase.from('devices').insert({
      project_id: projectId,
      device_number: maxNum + 1,
      preparation_status: 'pending',
    });
    if (error) toast.error('Fehler: ' + error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      toast.success('Gerät hinzugefügt');
    }
  };

  // Filtering
  const filtered = useMemo(() => {
    if (!devices) return [];
    if (!search) return devices;
    const s = search.toLowerCase();
    return devices.filter(d =>
      [d.ist_manufacturer, d.ist_model, d.ist_serial, d.ist_ip, d.soll_manufacturer, d.soll_model, d.soll_serial, d.notes, d.customer_device_number, d.gegebenheiten]
        .filter(Boolean).some(v => v!.toLowerCase().includes(s))
      || (d.device_number && String(d.device_number).includes(s))
      || (d.location_id && locationMap[d.location_id]?.toLowerCase().includes(s))
    );
  }, [devices, search, locationMap]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? '';
      const bVal = (b as any)[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'de', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Group by location
  const grouped = useMemo(() => {
    const groups: { locationId: string | null; locationName: string; devices: Device[] }[] = [];
    const map = new Map<string, Device[]>();
    sorted.forEach(d => {
      const key = d.location_id || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    map.forEach((devs, key) => {
      groups.push({
        locationId: key === '__none__' ? null : key,
        locationName: key === '__none__' ? 'Ohne Standort' : (locationMap[key] || 'Unbekannter Standort'),
        devices: devs,
      });
    });
    return groups;
  }, [sorted, locationMap]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const getRowBg = (d: Device) => {
    if (d.optimization_type === 'Keep' || d.optimization_type === 'Nicht im Projekt') return 'bg-muted/50 text-muted-foreground';
    const hasIst = !!(d.ist_manufacturer || d.ist_model);
    const hasSoll = !!(d.soll_manufacturer || d.soll_model);
    if (hasIst && hasSoll) return 'bg-emerald-50/50';
    if (hasIst || hasSoll) return 'bg-amber-50/50';
    return '';
  };

  // Excel Export
  const exportExcel = () => {
    if (!devices?.length) { toast.error('Keine Geräte zum Exportieren'); return; }
    const rows = devices.map(d => ({
      'Nr': d.device_number,
      'KD-Nr': d.customer_device_number,
      'Standort': d.location_id ? locationMap[d.location_id] || '' : '',
      'IST Gebäude': d.ist_building, 'IST Etage': d.ist_floor, 'IST Zimmer': d.ist_room,
      'IST Hersteller': d.ist_manufacturer, 'IST Modell': d.ist_model, 'IST SerienNr': d.ist_serial,
      'IST IP': d.ist_ip, 'IST InventarNr': d.ist_inventory_number,
      'Abholen': d.ist_pickup ? 'Ja' : 'Nein',
      'Optimierung': d.optimization_type,
      'SOLL Hersteller': d.soll_manufacturer, 'SOLL Modell': d.soll_model,
      'SOLL Ausstattung': d.soll_options, 'SOLL SerienNr': d.soll_serial,
      'SOLL ID': d.soll_device_id,
      'SOLL Gebäude': d.soll_building, 'SOLL Etage': d.soll_floor, 'SOLL Zimmer': d.soll_room,
      'Gegebenheiten': d.gegebenheiten, 'Bemerkung': d.notes, 'Endkontrolle': d.final_check,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rolloutliste');
    XLSX.writeFile(wb, 'Rolloutliste.xlsx');
    toast.success('Excel exportiert');
  };

  const SortHeader = ({ label, field, className }: { label: string; field: string; className?: string }) => (
    <th
      className={cn('px-1.5 py-1.5 text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap', className)}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === field && <ArrowUpDown className="h-2.5 w-2.5" />}
      </span>
    </th>
  );

  if (isLoading) return <div className="text-muted-foreground py-12 text-center">Lade Rolloutliste...</div>;

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-heading font-bold text-foreground shrink-0">Rolloutliste</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-48 text-xs" />
          </div>
          <Button size="sm" variant="outline" onClick={addDevice} className="gap-1 font-heading text-xs">
            <Plus className="h-3.5 w-3.5" /> Gerät
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1 font-heading text-xs">
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1 font-heading text-xs">
            <Printer className="h-3.5 w-3.5" /> Druck
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground font-body print:hidden">
        <span>{devices?.length || 0} Geräte gesamt</span>
        <span>{grouped.length} Standorte</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-auto max-h-[calc(100vh-200px)] print:max-h-none print:overflow-visible">
        <table className="w-full min-w-[1800px] border-collapse text-xs print:min-w-0 print:text-[8px]">
          <thead className="sticky top-0 z-10 bg-card">
            {/* Group headers */}
            <tr className="border-b border-border">
              <th colSpan={3} className="px-1.5 py-1 text-[9px] font-heading font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 text-center border-r border-border">
                Allgemein
              </th>
              <th colSpan={11} className="px-1.5 py-1 text-[9px] font-heading font-bold uppercase tracking-widest bg-primary/5 text-primary text-center border-r border-border">
                IST-Situation (Altgerät)
              </th>
              <th colSpan={12} className="px-1.5 py-1 text-[9px] font-heading font-bold uppercase tracking-widest bg-secondary/5 text-secondary text-center">
                SOLL-Situation (Neugerät)
              </th>
            </tr>
            {/* Column headers */}
            <tr className="border-b-2 border-border bg-card">
              {/* General */}
              <SortHeader label="Nr" field="device_number" className="w-10 border-r border-border/50" />
              <SortHeader label="KD-Nr" field="customer_device_number" className="w-16 border-r border-border/50" />
              <SortHeader label="Liefertermin" field="delivery_date" className="w-20 border-r border-border" />
              {/* IST */}
              <SortHeader label="Gebäude" field="ist_building" className="border-r border-border/50" />
              <SortHeader label="Etage" field="ist_floor" className="w-12 border-r border-border/50" />
              <SortHeader label="Zimmer" field="ist_room" className="w-14 border-r border-border/50" />
              <SortHeader label="Hersteller" field="ist_manufacturer" className="border-r border-border/50" />
              <SortHeader label="Modell" field="ist_model" className="border-r border-border/50" />
              <SortHeader label="SerienNr" field="ist_serial" className="border-r border-border/50" />
              <SortHeader label="IP" field="ist_ip" className="border-r border-border/50" />
              <SortHeader label="InventarNr" field="ist_inventory_number" className="border-r border-border/50" />
              <SortHeader label="Abh." field="ist_pickup" className="w-10 border-r border-border/50" />
              <SortHeader label="Opt." field="optimization_type" className="w-24 border-r border-border" />
              {/* SOLL */}
              <SortHeader label="Hersteller" field="soll_manufacturer" className="border-r border-border/50" />
              <SortHeader label="Modell" field="soll_model" className="border-r border-border/50" />
              <SortHeader label="Ausstattung" field="soll_options" className="border-r border-border/50" />
              <SortHeader label="SerienNr" field="soll_serial" className="border-r border-border/50" />
              <SortHeader label="ID" field="soll_device_id" className="w-14 border-r border-border/50" />
              <SortHeader label="Gebäude" field="soll_building" className="border-r border-border/50" />
              <SortHeader label="Etage" field="soll_floor" className="w-12 border-r border-border/50" />
              <SortHeader label="Zimmer" field="soll_room" className="w-14 border-r border-border/50" />
              <SortHeader label="Gegeb." field="gegebenheiten" className="border-r border-border/50" />
              <SortHeader label="Bem." field="notes" className="border-r border-border/50" />
              <th className="px-1.5 py-1.5 text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Endktr.</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={25} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Noch keine Geräte vorhanden.</p>
                    <p className="text-xs text-muted-foreground">Importiere eine IST-Liste oder füge Geräte manuell hinzu.</p>
                  </div>
                </td>
              </tr>
            )}
            {grouped.map(group => (
              <GroupRows
                key={group.locationId || '__none__'}
                group={group}
                onUpdate={debouncedUpdate}
                getRowBg={getRowBg}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ group, onUpdate, getRowBg }: {
  group: { locationId: string | null; locationName: string; devices: Device[] };
  onUpdate: (id: string, field: string, value: any) => void;
  getRowBg: (d: Device) => string;
}) {
  return (
    <>
      {/* Location header row */}
      <tr className="bg-primary/8 border-t-2 border-primary/20">
        <td colSpan={25} className="px-3 py-2">
          <span className="font-heading font-bold text-xs text-primary">
            📍 {group.locationName}
          </span>
          <span className="ml-3 text-[10px] text-muted-foreground font-body">
            ({group.devices.length} Geräte)
          </span>
        </td>
      </tr>
      {group.devices.map(d => (
        <DeviceRow key={d.id} device={d} onUpdate={onUpdate} rowBg={getRowBg(d)} />
      ))}
    </>
  );
}

function DeviceRow({ device: d, onUpdate, rowBg }: {
  device: Device;
  onUpdate: (id: string, field: string, value: any) => void;
  rowBg: string;
}) {
  const isGrayed = d.optimization_type === 'Keep' || d.optimization_type === 'Nicht im Projekt';
  const cellCn = isGrayed ? 'opacity-60' : '';

  return (
    <tr className={cn('border-b border-border/50 hover:bg-muted/30 transition-colors', rowBg)}>
      {/* General */}
      <td className="border-r border-border/30"><EditableCell value={d.device_number} onChange={v => onUpdate(d.id, 'device_number', v ? parseInt(v) : null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.customer_device_number} onChange={v => onUpdate(d.id, 'customer_device_number', v || null)} className={cellCn} /></td>
      <td className="border-r border-border"><EditableCell value={d.delivery_date} onChange={v => onUpdate(d.id, 'delivery_date', v || null)} className={cellCn} /></td>
      {/* IST */}
      <td className="border-r border-border/30"><EditableCell value={d.ist_building} onChange={v => onUpdate(d.id, 'ist_building', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_floor} onChange={v => onUpdate(d.id, 'ist_floor', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_room} onChange={v => onUpdate(d.id, 'ist_room', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_manufacturer} onChange={v => onUpdate(d.id, 'ist_manufacturer', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_model} onChange={v => onUpdate(d.id, 'ist_model', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_serial} onChange={v => onUpdate(d.id, 'ist_serial', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_ip} onChange={v => onUpdate(d.id, 'ist_ip', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.ist_inventory_number} onChange={v => onUpdate(d.id, 'ist_inventory_number', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell type="checkbox" value={d.ist_pickup} onChange={v => onUpdate(d.id, 'ist_pickup', v)} /></td>
      <td className="border-r border-border"><EditableCell type="select" value={d.optimization_type} onChange={v => onUpdate(d.id, 'optimization_type', v || null)} options={OPTIMIZATION_OPTIONS} /></td>
      {/* SOLL */}
      <td className="border-r border-border/30"><EditableCell value={d.soll_manufacturer} onChange={v => onUpdate(d.id, 'soll_manufacturer', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_model} onChange={v => onUpdate(d.id, 'soll_model', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_options} onChange={v => onUpdate(d.id, 'soll_options', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_serial} onChange={v => onUpdate(d.id, 'soll_serial', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_device_id} onChange={v => onUpdate(d.id, 'soll_device_id', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_building} onChange={v => onUpdate(d.id, 'soll_building', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_floor} onChange={v => onUpdate(d.id, 'soll_floor', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.soll_room} onChange={v => onUpdate(d.id, 'soll_room', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.gegebenheiten} onChange={v => onUpdate(d.id, 'gegebenheiten', v || null)} className={cellCn} /></td>
      <td className="border-r border-border/30"><EditableCell value={d.notes} onChange={v => onUpdate(d.id, 'notes', v || null)} className={cellCn} /></td>
      <td><FinalCheckChip value={d.final_check} onChange={v => onUpdate(d.id, 'final_check', v)} /></td>
    </tr>
  );
}
