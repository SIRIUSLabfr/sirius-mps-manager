import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, Filter, Search, CheckSquare, Plus, Pencil, Check, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const OPT_TYPES = [
  { value: 'OneToOne', label: 'OneToOne', color: 'text-emerald-700' },
  { value: 'Umzug', label: 'Umzug', color: 'text-blue-700' },
  { value: 'Keep', label: 'Keep', color: 'text-muted-foreground' },
  { value: 'Neuaufstellung', label: 'Neuaufstellung', color: 'text-cyan-700' },
  { value: 'Nicht im Projekt', label: 'Nicht im Projekt', color: 'text-muted-foreground' },
  { value: 'Abbau', label: 'Abbau', color: 'text-red-700' },
] as const;

interface Props {
  devices: Tables<'devices'>[];
  locations: Tables<'locations'>[];
  projectId: string;
  onRefresh: () => void;
}

export default function ComparisonView({ devices, locations, projectId, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterOptType, setFilterOptType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpt, setBulkOpt] = useState<string>('');
  const [editingIst, setEditingIst] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ manufacturer: string; model: string; room: string }>({ manufacturer: '', model: '', room: '' });
  const [addingIst, setAddingIst] = useState(false);
  const [newIst, setNewIst] = useState<{ manufacturer: string; model: string; room: string; building: string }>({ manufacturer: '', model: '', room: '', building: '' });
  // Separate IST and SOLL devices
  const istDevices = useMemo(() => devices.filter(d => d.ist_manufacturer || d.ist_model || d.ist_serial), [devices]);
  const sollDevices = useMemo(() => devices.filter(d => (d.soll_manufacturer || d.soll_model) && !d.ist_manufacturer && !d.ist_model), [devices]);
  // Combined devices (have both IST and SOLL on the same row)
  const combinedDevices = useMemo(() => devices.filter(d => (d.ist_manufacturer || d.ist_model) && (d.soll_manufacturer || d.soll_model)), [devices]);

  // Build display rows: combined first, then unmatched IST, then unmatched SOLL
  const allRows = useMemo(() => {
    const combined = combinedDevices.map(d => ({ type: 'combined' as const, device: d, istDevice: d, sollDevice: d }));
    const unmatchedIst = istDevices.filter(d => !d.soll_manufacturer && !d.soll_model && !d.mapped_to_device_id)
      .map(d => ({ type: 'ist_only' as const, device: d, istDevice: d, sollDevice: null as Tables<'devices'> | null }));
    const mappedIst = istDevices.filter(d => d.mapped_to_device_id)
      .map(d => {
        const soll = devices.find(s => s.id === d.mapped_to_device_id);
        return { type: 'mapped' as const, device: d, istDevice: d, sollDevice: soll || null };
      });
    const usedSollIds = new Set([...mappedIst.map(r => r.sollDevice?.id).filter(Boolean)]);
    const unmatchedSoll = sollDevices.filter(d => !usedSollIds.has(d.id))
      .map(d => ({ type: 'soll_only' as const, device: d, istDevice: null as Tables<'devices'> | null, sollDevice: d }));

    return [...combined, ...mappedIst, ...unmatchedIst, ...unmatchedSoll];
  }, [combinedDevices, istDevices, sollDevices, devices]);

  // Manufacturers for filter
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    devices.forEach(d => {
      if (d.ist_manufacturer) set.add(d.ist_manufacturer);
      if (d.soll_manufacturer) set.add(d.soll_manufacturer);
    });
    return [...set].sort();
  }, [devices]);

  // Available SOLL devices for mapping dropdown
  const availableSollDevices = useMemo(() =>
    sollDevices.filter(d => !devices.some(ist => ist.mapped_to_device_id === d.id)),
    [sollDevices, devices]
  );

  // Apply filters
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      const d = row.device;
      // Search
      if (search) {
        const s = search.toLowerCase();
        const fields = [d.ist_manufacturer, d.ist_model, d.ist_serial, d.soll_manufacturer, d.soll_model, d.soll_serial, d.ist_room, d.soll_room].filter(Boolean);
        if (!fields.some(f => f!.toLowerCase().includes(s))) return false;
      }
      // Location
      if (filterLocation !== 'all' && d.location_id !== filterLocation) return false;
      // Opt type
      if (filterOptType !== 'all' && d.optimization_type !== filterOptType) return false;
      // Status
      if (filterStatus === 'zugeordnet' && row.type !== 'combined' && row.type !== 'mapped') return false;
      if (filterStatus === 'offen' && (row.type === 'combined' || row.type === 'mapped')) return false;
      // Manufacturer
      if (filterManufacturer !== 'all') {
        if (d.ist_manufacturer !== filterManufacturer && d.soll_manufacturer !== filterManufacturer) return false;
      }
      return true;
    });
  }, [allRows, search, filterLocation, filterOptType, filterStatus, filterManufacturer]);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map(r => r.device.id)));
    }
  };

  const handleOptChange = async (deviceId: string, value: string) => {
    const { error } = await supabase.from('devices').update({ optimization_type: value || null }).eq('id', deviceId);
    if (error) toast.error('Fehler beim Speichern');
    else onRefresh();
  };

  const handleMapSoll = async (istDeviceId: string, sollDeviceId: string) => {
    const { error } = await supabase.from('devices').update({ mapped_to_device_id: sollDeviceId || null }).eq('id', istDeviceId);
    if (error) toast.error('Fehler beim Zuordnen');
    else {
      toast.success('Zuordnung gespeichert');
      onRefresh();
    }
  };

  const handleBulkOptimization = async () => {
    if (!bulkOpt || selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from('devices').update({ optimization_type: bulkOpt }).in('id', ids);
    if (error) toast.error('Fehler');
    else {
      toast.success(`${ids.length} Geräte aktualisiert`);
      setSelected(new Set());
      setBulkOpt('');
      onRefresh();
    }
  };

  const handleAddIstDevice = async () => {
    if (!newIst.manufacturer && !newIst.model) return;
    const maxNum = devices.reduce((max, d) => Math.max(max, d.device_number || 0), 0);
    const { error } = await supabase.from('devices').insert({
      project_id: projectId,
      device_number: maxNum + 1,
      ist_manufacturer: newIst.manufacturer || null,
      ist_model: newIst.model || null,
      ist_room: newIst.room || null,
      ist_building: newIst.building || null,
      preparation_status: 'pending',
      ist_source: 'manual',
    });
    if (error) toast.error('Fehler: ' + error.message);
    else {
      toast.success('IST-Gerät angelegt');
      setNewIst({ manufacturer: '', model: '', room: '', building: '' });
      setAddingIst(false);
      onRefresh();
    }
  };

  const startEditIst = (d: Tables<'devices'>) => {
    setEditingIst(d.id);
    setEditValues({ manufacturer: d.ist_manufacturer || '', model: d.ist_model || '', room: d.ist_room || '' });
  };

  const saveEditIst = async () => {
    if (!editingIst) return;
    const { error } = await supabase.from('devices').update({
      ist_manufacturer: editValues.manufacturer || null,
      ist_model: editValues.model || null,
      ist_room: editValues.room || null,
    }).eq('id', editingIst);
    if (error) toast.error('Fehler');
    else { onRefresh(); setEditingIst(null); }
  };

  const getRowBg = (row: typeof allRows[0]) => {
    const opt = row.device.optimization_type;
    if (opt === 'Keep' || opt === 'Nicht im Projekt') return 'bg-muted/40 text-muted-foreground';
    if (row.type === 'combined' || row.type === 'mapped') return 'bg-emerald-50/40';
    if (row.type === 'ist_only') return 'bg-amber-50/40';
    if (row.type === 'soll_only') return 'bg-sky-50/40';
    return '';
  };

  const getLocationName = (locId: string | null) => {
    if (!locId) return '–';
    return locations.find(l => l.id === locId)?.short_name || locations.find(l => l.id === locId)?.name || '–';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
        </div>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-44 h-9 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Standort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Standorte</SelectItem>
            {locations.map(l => <SelectItem key={l.id} value={l.id} className="text-xs">{l.short_name || l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOptType} onValueChange={setFilterOptType}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Optimierung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Typen</SelectItem>
            {OPT_TYPES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle</SelectItem>
            <SelectItem value="zugeordnet" className="text-xs">Zugeordnet</SelectItem>
            <SelectItem value="offen" className="text-xs">Offen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Hersteller" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Hersteller</SelectItem>
            {manufacturers.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={() => setAddingIst(true)}>
          <Plus className="h-3.5 w-3.5" /> IST-Gerät manuell
        </Button>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-semibold">{selected.size} ausgewählt</span>
          <Select value={bulkOpt} onValueChange={setBulkOpt}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Optimierung setzen..." /></SelectTrigger>
            <SelectContent>
              {OPT_TYPES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleBulkOptimization} disabled={!bulkOpt} className="h-8 text-xs">Anwenden</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-8 text-xs ml-auto">Auswahl aufheben</Button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-8 px-2 py-2">
                  <Checkbox checked={selected.size === filteredRows.length && filteredRows.length > 0} onCheckedChange={toggleAll} />
                </th>
                <th colSpan={3} className="px-3 py-1.5 text-left border-r border-border">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-primary">IST-Gerät (Altgerät)</span>
                </th>
                <th className="px-3 py-1.5 text-center border-r border-border">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Optimierung</span>
                </th>
                <th colSpan={3} className="px-3 py-1.5 text-left border-r border-border">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-secondary">SOLL-Gerät (Neugerät)</span>
                </th>
                <th className="px-3 py-1.5 text-center">
                  <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Zuordnung</span>
                </th>
              </tr>
              <tr className="bg-muted/30 border-b border-border text-[10px] font-heading uppercase tracking-wide text-muted-foreground">
                <th className="w-8" />
                <th className="px-3 py-1 text-left">Hersteller / Modell</th>
                <th className="px-3 py-1 text-left">Standort</th>
                <th className="px-3 py-1 text-left border-r border-border">Raum</th>
                <th className="px-3 py-1 text-center border-r border-border">Typ</th>
                <th className="px-3 py-1 text-left">Hersteller / Modell</th>
                <th className="px-3 py-1 text-left">Standort</th>
                <th className="px-3 py-1 text-left border-r border-border">Raum</th>
                <th className="px-3 py-1 text-center">SOLL wählen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Keine Geräte gefunden</td></tr>
              ) : filteredRows.map(row => {
                const ist = row.istDevice;
                const soll = row.sollDevice;
                return (
                  <tr key={row.device.id} className={cn('transition-colors hover:bg-muted/20', getRowBg(row))}>
                    <td className="px-2 py-2">
                      <Checkbox checked={selected.has(row.device.id)} onCheckedChange={() => toggleSelected(row.device.id)} />
                    </td>
                    {/* IST */}
                    <td className="px-3 py-2">
                      {ist ? (
                        <div>
                          <span className="font-medium">{ist.ist_manufacturer || '–'}</span>
                          <span className="text-muted-foreground ml-1">{ist.ist_model || ''}</span>
                        </div>
                      ) : <span className="text-muted-foreground italic">–</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ist ? getLocationName(ist.location_id) : '–'}</td>
                    <td className="px-3 py-2 text-muted-foreground border-r border-border/50">
                      {ist ? [ist.ist_floor, ist.ist_room].filter(Boolean).join(' / ') || '–' : '–'}
                    </td>
                    {/* Optimization */}
                    <td className="px-2 py-2 border-r border-border/50">
                      <Select value={row.device.optimization_type || ''} onValueChange={v => handleOptChange(row.device.id, v)}>
                        <SelectTrigger className="h-7 text-[11px] w-32 mx-auto">
                          <SelectValue placeholder="–" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">– keine –</SelectItem>
                          {OPT_TYPES.map(o => <SelectItem key={o.value} value={o.value} className={cn('text-xs', o.color)}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    {/* SOLL */}
                    <td className="px-3 py-2">
                      {soll ? (
                        <div>
                          <span className="font-medium">{soll.soll_manufacturer || '–'}</span>
                          <span className="text-muted-foreground ml-1">{soll.soll_model || ''}</span>
                        </div>
                      ) : <span className="text-muted-foreground italic">–</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{soll ? getLocationName(soll.location_id) : '–'}</td>
                    <td className="px-3 py-2 text-muted-foreground border-r border-border/50">
                      {soll ? [soll.soll_floor, soll.soll_room].filter(Boolean).join(' / ') || '–' : '–'}
                    </td>
                    {/* Mapping action */}
                    <td className="px-2 py-2">
                      {row.type === 'combined' || row.type === 'mapped' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-heading font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          ✓ Zugeordnet
                        </span>
                      ) : row.type === 'ist_only' && availableSollDevices.length > 0 ? (
                        <Select value={ist?.mapped_to_device_id || ''} onValueChange={v => ist && handleMapSoll(ist.id, v)}>
                          <SelectTrigger className="h-7 text-[10px] w-36">
                            <SelectValue placeholder="SOLL wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSollDevices.map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                {s.soll_manufacturer} {s.soll_model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : row.type === 'soll_only' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-heading font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
                          Neuaufstellung
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-right">{filteredRows.length} von {allRows.length} Geräten angezeigt</p>
    </div>
  );
}
