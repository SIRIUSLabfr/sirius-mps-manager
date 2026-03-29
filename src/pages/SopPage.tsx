import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUsers } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import KanbanColumn from '@/components/sop/KanbanColumn';
import SopCard from '@/components/sop/SopCard';
import SopDetailSheet from '@/components/sop/SopDetailSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Printer, Search, CalendarIcon, RefreshCw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const COLUMNS = [
  { id: 'pending', title: 'Ausstehend', color: 'bg-muted/60' },
  { id: 'in_progress', title: 'In Bearbeitung', color: 'bg-amber-50' },
  { id: 'prepared', title: 'Vorgerichtet', color: 'bg-emerald-50' },
  { id: 'delivered', title: 'Ausgeliefert', color: 'bg-sky-50' },
  { id: 'checked', title: 'Endkontrolle OK', color: 'bg-emerald-100' },
];

function useAllSopOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sop_orders_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sop_orders')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('sop-orders-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sop_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sop_orders_all'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

function useAllProjects() {
  return useQuery({
    queryKey: ['projects_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, customer_name, project_name, project_number, project_type').order('customer_name');
      if (error) throw error;
      return data;
    },
  });
}

export default function SopPage() {
  const { data: sopOrders } = useAllSopOrders();
  const { data: projects } = useAllProjects();
  const { data: users } = useUsers();
  const queryClient = useQueryClient();

  const [activeSop, setActiveSop] = useState<Tables<'sop_orders'> | null>(null);
  const [selectedSop, setSelectedSop] = useState<Tables<'sop_orders'> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTechnician, setFilterTechnician] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getUserName = useCallback((id: string | null) => {
    if (!id || !users) return undefined;
    const u = users.find(u => u.id === id);
    return u?.short_code || u?.full_name || undefined;
  }, [users]);

  const getProjectLabel = useCallback((projectId: string) => {
    const p = projects?.find(p => p.id === projectId);
    if (!p) return '';
    return p.project_name || p.customer_name || p.project_number || '';
  }, [projects]);

  // Filter SOP orders
  const filteredOrders = useMemo(() => {
    if (!sopOrders) return [];
    return sopOrders.filter(sop => {
      if (search) {
        const s = search.toLowerCase();
        if (![sop.model, sop.manufacturer, sop.serial_number, sop.ow_number].some(f => f?.toLowerCase().includes(s))) return false;
      }
      if (filterTechnician !== 'all' && sop.technician !== filterTechnician) return false;
      if (filterProject !== 'all' && sop.project_id !== filterProject) return false;
      if (dateFrom && sop.delivery_date && new Date(sop.delivery_date) < dateFrom) return false;
      if (dateTo && sop.delivery_date && new Date(sop.delivery_date) > dateTo) return false;
      return true;
    });
  }, [sopOrders, search, filterTechnician, filterProject, dateFrom, dateTo]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSop(null);
    if (!over) return;

    const sopId = active.id as string;
    const overId = over.id as string;

    let newStatus: string;
    if (COLUMNS.some(c => c.id === overId)) {
      newStatus = overId;
    } else {
      const targetSop = sopOrders?.find(s => s.id === overId);
      if (!targetSop) return;
      newStatus = targetSop.preparation_status;
    }

    const sop = sopOrders?.find(s => s.id === sopId);
    if (!sop || sop.preparation_status === newStatus) return;

    queryClient.setQueryData(['sop_orders_all'], (old: Tables<'sop_orders'>[] | undefined) =>
      old?.map(s => s.id === sopId ? { ...s, preparation_status: newStatus } : s)
    );

    const { error } = await supabase.from('sop_orders').update({ preparation_status: newStatus }).eq('id', sopId);
    if (error) {
      toast.error('Status-Update fehlgeschlagen');
      queryClient.invalidateQueries({ queryKey: ['sop_orders_all'] });
    }

    if (sop.device_id) {
      await supabase.from('devices').update({ preparation_status: newStatus }).eq('id', sop.device_id);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">SOP / Vorrichten</h1>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-heading" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" /> Druckansicht
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Modell, SN, OW..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm h-9" />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48 h-9 text-xs"><SelectValue placeholder="Projekt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Projekte</SelectItem>
            {projects?.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.project_name || p.customer_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
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
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
          {activeSop ? (
            <div className="rotate-[2deg] scale-105 shadow-xl opacity-90">
              <SopCard sop={activeSop} technicianName={getUserName(activeSop.technician)} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detail Sheet */}
      <SopDetailSheet
        sop={selectedSop}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        users={users || []}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['sop_orders_all'] })}
      />

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
