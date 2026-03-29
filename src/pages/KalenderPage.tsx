import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Calendar as BigCalendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

const locales = { de };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: de }), getDay, locales });
const DnDCalendar = withDragAndDrop<CalEvent>(BigCalendar as any);

const PROJECT_COLORS = [
  'hsl(216,100%,32%)', 'hsl(196,100%,44%)', 'hsl(142,70%,40%)', 'hsl(32,90%,50%)',
  'hsl(0,70%,50%)', 'hsl(270,60%,50%)', 'hsl(180,60%,40%)', 'hsl(45,90%,45%)',
];

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  device: Tables<'devices'>;
  color: string;
  projectId: string;
}

const MESSAGES = {
  today: 'Heute', previous: '‹', next: '›', month: 'Monat', week: 'Woche',
  day: 'Tag', agenda: 'Agenda', noEventsInRange: 'Keine Termine in diesem Zeitraum.',
  showMore: (total: number) => `+${total} weitere`,
};

function useAllDevicesWithDelivery() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['devices_calendar_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .not('delivery_date', 'is', null)
        .order('delivery_date');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('devices-calendar-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        queryClient.invalidateQueries({ queryKey: ['devices_calendar_all'] });
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

export default function KalenderPage() {
  const { data: devices } = useAllDevicesWithDelivery();
  const { data: projects } = useAllProjects();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const DAILY_COLOR = 'hsl(32,100%,50%)';

  const projectColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects?.forEach((p, i) => { map[p.id] = PROJECT_COLORS[i % PROJECT_COLORS.length]; });
    return map;
  }, [projects]);

  const getProjectLabel = useCallback((projectId: string) => {
    const p = projects?.find(p => p.id === projectId);
    return p?.project_name || p?.customer_name || '';
  }, [projects]);

  const events: CalEvent[] = useMemo(() => {
    if (!devices) return [];
    let filtered = filterProject === 'all' ? devices : devices.filter(d => d.project_id === filterProject);
    if (filterType !== 'all') {
      filtered = filtered.filter(d => {
        const proj = projects?.find(p => p.id === d.project_id);
        const pType = (proj as any)?.project_type || 'project';
        return pType === filterType;
      });
    }
    return filtered.map(d => {
      const dateObj = new Date(d.delivery_date!);
      const model = d.soll_model || d.ist_model || 'Gerät';
      const proj = getProjectLabel(d.project_id);
      const projData = projects?.find(p => p.id === d.project_id);
      const pType = (projData as any)?.project_type || 'project';
      return {
        id: d.id,
        title: proj ? `${model} – ${proj}` : model,
        start: dateObj,
        end: dateObj,
        device: d,
        color: pType === 'daily' ? DAILY_COLOR : (projectColorMap[d.project_id] || PROJECT_COLORS[0]),
        projectId: d.project_id,
      };
    });
  }, [devices, filterProject, filterType, projectColorMap, getProjectLabel, projects, DAILY_COLOR]);

  const selectedDateDevices = useMemo(() => {
    if (!selectedDate || !devices) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const filtered = filterProject === 'all' ? devices : devices.filter(d => d.project_id === filterProject);
    return filtered.filter(d => d.delivery_date === dateStr);
  }, [selectedDate, devices, filterProject]);

  const handleEventDrop = useCallback(async ({ event, start }: { event: CalEvent; start: Date }) => {
    const newDate = format(start, 'yyyy-MM-dd');
    const { error } = await supabase.from('devices').update({ delivery_date: newDate }).eq('id', event.id);
    if (error) toast.error('Fehler beim Verschieben');
    else {
      queryClient.invalidateQueries({ queryKey: ['devices_calendar_all'] });
      toast.success('Liefertermin aktualisiert');
    }
  }, [queryClient]);

  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    setSelectedDate(start);
    setSheetOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: CalEvent) => {
    setSelectedDate(event.start);
    setSheetOpen(true);
  }, []);

  const eventStyleGetter = useCallback((event: CalEvent) => ({
    style: {
      backgroundColor: event.color,
      border: 'none',
      borderRadius: '4px',
      color: '#fff',
      fontSize: '11px',
      padding: '1px 4px',
    },
  }), []);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: 'Ausstehend', in_progress: 'In Bearbeitung', prepared: 'Vorgerichtet', delivered: 'Ausgeliefert', checked: 'Geprüft' };
    return map[s] || s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Rollout-Kalender</h1>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Projekt filtern" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Projekte</SelectItem>
            {projects?.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.project_name || p.customer_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 calendar-wrapper">
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={['month', 'week', 'day']}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop as any}
          draggableAccessor={() => true}
          eventPropGetter={eventStyleGetter as any}
          messages={MESSAGES}
          culture="de"
          style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}
          popup
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">
              {selectedDate ? format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de }) : ''}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{selectedDateDevices.length} Geräte an diesem Tag</p>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {selectedDateDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Geräte für diesen Tag geplant.</p>
            ) : selectedDateDevices.map(d => (
              <div key={d.id} className="border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading font-bold text-sm">{d.soll_model || d.ist_model || '–'}</p>
                    <p className="text-xs text-muted-foreground">{d.soll_manufacturer || d.ist_manufacturer || ''}</p>
                  </div>
                  <Badge
                    variant={d.preparation_status === 'prepared' || d.preparation_status === 'checked' ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {statusLabel(d.preparation_status)}
                  </Badge>
                </div>
                <p className="text-[11px] text-primary font-medium">📋 {getProjectLabel(d.project_id)}</p>
                {(d.soll_floor || d.soll_room) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[d.soll_floor, d.soll_room].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <style>{`
        .calendar-wrapper .rbc-toolbar {
          font-family: 'Montserrat', sans-serif; font-size: 13px; margin-bottom: 12px;
        }
        .calendar-wrapper .rbc-toolbar button {
          border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 600;
          border: 1px solid hsl(var(--border)); background: transparent; color: hsl(var(--foreground));
        }
        .calendar-wrapper .rbc-toolbar button:hover { background: hsl(var(--muted)); }
        .calendar-wrapper .rbc-toolbar button.rbc-active {
          background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-color: hsl(var(--primary));
        }
        .calendar-wrapper .rbc-header {
          font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: hsl(var(--muted-foreground));
          padding: 8px 4px; border-bottom: 1px solid hsl(var(--border));
        }
        .calendar-wrapper .rbc-month-view, .calendar-wrapper .rbc-time-view {
          border: 1px solid hsl(var(--border)); border-radius: 8px; overflow: hidden;
        }
        .calendar-wrapper .rbc-day-bg + .rbc-day-bg,
        .calendar-wrapper .rbc-month-row + .rbc-month-row { border-color: hsl(var(--border)); }
        .calendar-wrapper .rbc-off-range-bg { background: hsl(var(--muted) / 0.3); }
        .calendar-wrapper .rbc-today { background: hsl(var(--primary) / 0.05); }
        .calendar-wrapper .rbc-event { font-family: 'Roboto', sans-serif; }
        .calendar-wrapper .rbc-show-more {
          font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: hsl(var(--primary));
        }
        .calendar-wrapper .rbc-date-cell {
          font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 600; padding: 4px 8px;
        }
      `}</style>
    </div>
  );
}
