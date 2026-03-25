import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime, useLocations } from '@/hooks/useRolloutData';
import { useSopOrders } from '@/hooks/useSopData';
import { useUsers } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import KanbanColumn from '@/components/sop/KanbanColumn';
import SopDetailSheet from '@/components/sop/SopDetailSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Cog, Printer, Search, CalendarIcon, RefreshCw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const COLUMNS = [
  { id: 'pending', title: 'Ausstehend', color: 'bg-muted/60' },
  { id: 'in_progress', title: 'In Bearbeitung', color: 'bg-amber-50' },
  { id: 'prepared', title: 'Vorgerichtet', color: 'bg-emerald-50' },
  { id: 'delivered', title: 'Ausgeliefert', color: 'bg-sky-50' },
  { id: 'checked', title: 'Endkontrolle OK', color: 'bg-emerald-100' },
];

export default function SopPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: devices } = useDevicesRealtime(projectId || null);
  const { data: locations } = useLocations(projectId || null);
  const { data: sopOrders } = useSopOrders(projectId || null);
  const { data: users } = useUsers();
  const queryClient = useQueryClient();

  const [activeSop, setActiveSop] = useState<Tables<'sop_orders'> | null>(null);
  const [selectedSop, setSelectedSop] = useState<Tables<'sop_orders'> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'overwrite' | 'append' | null>(null);
  const [existingCount, setExistingCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTechnician, setFilterTechnician] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getUserName = useCallback((id: string | null) => {
    if (!id || !users) return undefined;
    const u = users.find(u => u.id === id);
    return u?.short_code || u?.full_name || undefined;
  }, [users]);

  const getLocationAddress = useCallback((locId: string | null) => {
    if (!locId || !locations) return '';
    const l = locations.find(l => l.id === locId);
    if (!l) return '';
    return [l.name, l.address_street, l.address_zip, l.address_city].filter(Boolean).join(', ');
  }, [locations]);

  // Filter SOP orders
  const filteredOrders = useMemo(() => {
    if (!sopOrders) return [];
    return sopOrders.filter(sop => {
      if (search) {
        const s = search.toLowerCase();
        if (![sop.model, sop.manufacturer, sop.serial_number, sop.ow_number].some(f => f?.toLowerCase().includes(s))) return false;
      }
      if (filterTechnician !== 'all' && sop.technician !== filterTechnician) return false;
      if (dateFrom && sop.delivery_date && new Date(sop.delivery_date) < dateFrom) return false;
      if (dateTo && sop.delivery_date && new Date(sop.delivery_date) > dateTo) return false;
      return true;
    });
  }, [sopOrders, search, filterTechnician, dateFrom, dateTo]);

  // Group by status
  const columnData = useMemo(() => {
    const map: Record<string, Tables<'sop_orders'>[]> = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    filteredOrders.forEach(sop => {
      const col = map[sop.preparation_status] ? sop.preparation_status : 'pending';
      map[col].push(sop);
    });
    return map;
  }, [filteredOrders]);

  const handleDragStart = (event: DragStartEvent) => {
    const sop = sopOrders?.find(s => s.id === event.active.id) || null;
    setActiveSop(sop);
  };

  // Drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sopId = active.id as string;
    const newStatus = over.id as string;

    // Check if dropped on a column
    if (!COLUMNS.some(c => c.id === newStatus)) return;

    const sop = sopOrders?.find(s => s.id === sopId);
    if (!sop || sop.preparation_status === newStatus) return;

    // Optimistic update
    queryClient.setQueryData(['sop_orders', projectId], (old: Tables<'sop_orders'>[] | undefined) =>
      old?.map(s => s.id === sopId ? { ...s, preparation_status: newStatus } : s)
    );

    const { error } = await supabase.from('sop_orders').update({ preparation_status: newStatus }).eq('id', sopId);
    if (error) {
      toast.error('Status-Update fehlgeschlagen');
      queryClient.invalidateQueries({ queryKey: ['sop_orders', projectId] });
    }

    // Also update the linked device
    if (sop.device_id) {
      await supabase.from('devices').update({ preparation_status: newStatus }).eq('id', sop.device_id);
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
    }
  };

  // Generate SOPs
  const handleGenerateClick = () => {
    const existing = sopOrders?.length || 0;
    if (existing > 0) {
      setExistingCount(existing);
      setConfirmDialog('overwrite');
    } else {
      generateSops('create');
    }
  };

  const generateSops = async (mode: 'create' | 'overwrite' | 'append') => {
    if (!projectId || !devices) return;
    setGenerating(true);
    setConfirmDialog(null);

    try {
      if (mode === 'overwrite') {
        await supabase.from('sop_orders').delete().eq('project_id', projectId);
      }

      const sollDevices = devices.filter(d => d.soll_model);
      const existingDeviceIds = mode === 'append'
        ? new Set(sopOrders?.map(s => s.device_id).filter(Boolean))
        : new Set<string>();

      const newSops = sollDevices
        .filter(d => !existingDeviceIds.has(d.id))
        .map(d => {
          const locAddress = getLocationAddress(d.location_id);
          const options = [d.soll_options, d.soll_accessories].filter(Boolean).join(', ');
          return {
            project_id: projectId,
            device_id: d.id,
            manufacturer: d.soll_manufacturer || null,
            model: d.soll_model || null,
            serial_number: d.soll_serial || null,
            device_internal_id: d.soll_device_id || null,
            options: options || null,
            delivery_address: locAddress || null,
            floor: d.soll_floor || null,
            room: d.soll_room || null,
            delivery_date: d.delivery_date || null,
            remarks: d.notes || null,
            preparation_status: 'pending',
            delivery_status: 'pending',
          };
        });

      if (newSops.length === 0) {
        toast.info('Keine neuen SOLL-Geräte gefunden');
        setGenerating(false);
        return;
      }

      for (let i = 0; i < newSops.length; i += 50) {
        const { error } = await supabase.from('sop_orders').insert(newSops.slice(i, i + 50));
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['sop_orders', projectId] });
      toast.success(`${newSops.length} SOP-Einträge generiert`);
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">SOP / Vorrichten</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-heading" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Druckansicht
          </Button>
          <Button size="sm" className="gap-1.5 text-xs font-heading" onClick={handleGenerateClick} disabled={generating}>
            <Cog className={cn('h-3.5 w-3.5', generating && 'animate-spin')} />
            {generating ? 'Generiere...' : 'SOP generieren'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Modell, SN, OW..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
        </div>
        <Select value={filterTechnician} onValueChange={setFilterTechnician}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Techniker" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Techniker</SelectItem>
            {users?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.short_code || u.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1.5', dateFrom && 'text-foreground')}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : 'Von'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1.5', dateTo && 'text-foreground')}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, 'dd.MM.yyyy') : 'Bis'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 print:flex-col print:overflow-visible">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              color={col.color}
              items={columnData[col.id] || []}
              getUserName={getUserName}
              onCardClick={(sop) => { setSelectedSop(sop); setSheetOpen(true); }}
            />
          ))}
        </div>
      </DndContext>

      {/* Detail Sheet */}
      <SopDetailSheet
        sop={selectedSop}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        users={users || []}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['sop_orders', projectId] })}
      />

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog !== null} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">SOP-Einträge existieren bereits</AlertDialogTitle>
            <AlertDialogDescription>
              Es existieren bereits {existingCount} SOP-Einträge für dieses Projekt. Was möchtest du tun?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateSops('append')} className="bg-secondary hover:bg-secondary/90">
              Nur neue hinzufügen
            </AlertDialogAction>
            <AlertDialogAction onClick={() => generateSops('overwrite')} className="bg-destructive hover:bg-destructive/90">
              Alle überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
    </div>
  );
}
