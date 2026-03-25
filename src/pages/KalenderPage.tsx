import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar as BigCalendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime, useLocations } from '@/hooks/useRolloutData';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

const locales = { de };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: de }), getDay, locales });

const LOCATION_COLORS = [
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
}

const MESSAGES = {
  today: 'Heute',
  previous: '‹',
  next: '›',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  agenda: 'Agenda',
  noEventsInRange: 'Keine Termine in diesem Zeitraum.',
  showMore: (total: number) => `+${total} weitere`,
};

export default function KalenderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: devices } = useDevicesRealtime(projectId || null);
  const { data: locations } = useLocations(projectId || null);
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => { if (projectId) setActiveProjectId(projectId); }, [projectId, setActiveProjectId]);

  // Location color map
  const locationColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    locations?.forEach((l, i) => { map[l.id] = LOCATION_COLORS[i % LOCATION_COLORS.length]; });
    return map;
  }, [locations]);

  const getLocationName = useCallback((locId: string | null) => {
    if (!locId || !locations) return '';
    const l = locations.find(l => l.id === locId);
    return l?.short_name || l?.name?.substring(0, 20) || '';
  }, [locations]);

  // Build events
  const events: CalEvent[] = useMemo(() => {
    if (!devices) return [];
    return devices
      .filter(d => d.delivery_date)
      .map(d => {
        const dateObj = new Date(d.delivery_date!);
        const model = d.soll_model || d.ist_model || 'Gerät';
        const loc = getLocationName(d.location_id);
        return {
          id: d.id,
          title: loc ? `${model} – ${loc}` : model,
          start: dateObj,
          end: dateObj,
          device: d,
          color: d.location_id ? (locationColorMap[d.location_id] || LOCATION_COLORS[0]) : LOCATION_COLORS[0],
        };
      });
  }, [devices, locationColorMap, getLocationName]);

  // Devices for selected date
  const selectedDateDevices = useMemo(() => {
    if (!selectedDate || !devices) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return devices.filter(d => d.delivery_date === dateStr);
  }, [selectedDate, devices]);

  // Drag & drop: move event to new date
  const handleEventDrop = useCallback(async ({ event, start }: { event: CalEvent; start: Date }) => {
    const newDate = format(start, 'yyyy-MM-dd');
    const { error } = await supabase.from('devices').update({ delivery_date: newDate }).eq('id', event.id);
    if (error) toast.error('Fehler beim Verschieben');
    else {
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      toast.success('Liefertermin aktualisiert');
    }
  }, [projectId, queryClient]);

  // Click on day
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
      <h1 className="text-2xl font-heading font-bold text-foreground">Rollout-Kalender</h1>

      <div className="bg-card border border-border rounded-lg p-4 calendar-wrapper">
        <BigCalendar
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
          eventPropGetter={eventStyleGetter}
          messages={MESSAGES}
          culture="de"
          style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}
          popup
        />
      </div>

      {/* Day detail sheet */}
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
                {d.location_id && (
                  <p className="text-[11px] text-muted-foreground">📍 {getLocationName(d.location_id)}</p>
                )}
                {(d.soll_floor || d.soll_room) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[d.soll_floor, d.soll_room].filter(Boolean).join(' / ')}
                  </p>
                )}
                {d.soll_serial && (
                  <p className="text-[10px] text-muted-foreground font-mono">SN: {d.soll_serial}</p>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Calendar styles override */}
      <style>{`
        .calendar-wrapper .rbc-toolbar {
          font-family: 'Montserrat', sans-serif;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .calendar-wrapper .rbc-toolbar button {
          border-radius: 6px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid hsl(var(--border));
          background: transparent;
          color: hsl(var(--foreground));
        }
        .calendar-wrapper .rbc-toolbar button:hover {
          background: hsl(var(--muted));
        }
        .calendar-wrapper .rbc-toolbar button.rbc-active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }
        .calendar-wrapper .rbc-header {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--muted-foreground));
          padding: 8px 4px;
          border-bottom: 1px solid hsl(var(--border));
        }
        .calendar-wrapper .rbc-month-view,
        .calendar-wrapper .rbc-time-view {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
        }
        .calendar-wrapper .rbc-day-bg + .rbc-day-bg,
        .calendar-wrapper .rbc-month-row + .rbc-month-row {
          border-color: hsl(var(--border));
        }
        .calendar-wrapper .rbc-off-range-bg {
          background: hsl(var(--muted) / 0.3);
        }
        .calendar-wrapper .rbc-today {
          background: hsl(var(--primary) / 0.05);
        }
        .calendar-wrapper .rbc-event {
          font-family: 'Roboto', sans-serif;
        }
        .calendar-wrapper .rbc-show-more {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: hsl(var(--primary));
        }
        .calendar-wrapper .rbc-date-cell {
          font-family: 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
        }
      `}</style>
    </div>
  );
}
