import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  sop: Tables<'sop_orders'>;
  technicianName?: string;
  projectColor?: string;
  customerName?: string;
  onClick: () => void;
}

export default function SopCard({ sop, technicianName, projectColor, customerName, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30'
      )}
      onClick={onClick}
    >
      {/* Colored left accent bar */}
      <div className="flex gap-2">
        {projectColor && (
          <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-1.5">
            <button {...attributes} {...listeners} className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              {/* Line 0: Customer name */}
              {customerName && (
                <p className="text-[10px] text-muted-foreground truncate">{customerName}</p>
              )}

              {/* Line 1: Manufacturer + Model */}
              <p className="text-sm font-heading font-bold truncate leading-tight">
                {[sop.manufacturer, sop.model].filter(Boolean).join(' · ') || '–'}
              </p>

              {/* Line 2: Device ID */}
              {(sop.device_internal_id || sop.serial_number || sop.ow_number) && (
                <p className="text-sm font-heading font-bold truncate leading-tight">
                  ID: {sop.device_internal_id || sop.serial_number || sop.ow_number}
                </p>
              )}

              {/* Line 3: Room */}
              {(sop.room || sop.floor) && (
                <p className="text-[11px] text-muted-foreground truncate">
                  📍 {[sop.floor, sop.room].filter(Boolean).join(' / ')}
                </p>
              )}
            </div>
          </div>

          {/* Line 4: Dates + Technician */}
          <div className="flex items-center gap-2 flex-wrap">
            {sop.delivery_date && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-body">
                📦 {format(new Date(sop.delivery_date), 'dd.MM.')}
              </span>
            )}
            {sop.end_check_date && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-body">
                ✅ {format(new Date(sop.end_check_date), 'dd.MM.')}
              </span>
            )}
            {technicianName && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-heading font-bold ml-auto">
                {technicianName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
