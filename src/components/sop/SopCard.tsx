import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  sop: Tables<'sop_orders'>;
  technicianName?: string;
  onClick: () => void;
}

export default function SopCard({ sop, technicianName, onClick }: Props) {
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
        'bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div>
            <p className="font-heading font-bold text-sm leading-tight truncate">{sop.model || '–'}</p>
            <p className="text-[11px] text-muted-foreground">{sop.manufacturer || ''}</p>
          </div>

          {sop.serial_number && (
            <p className="text-[10px] text-muted-foreground font-mono truncate">SN: {sop.serial_number}</p>
          )}

          {sop.delivery_address && (
            <p className="text-[10px] text-muted-foreground truncate">📍 {sop.delivery_address}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {sop.delivery_date && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-body">
                {format(new Date(sop.delivery_date), 'dd.MM.yyyy')}
              </span>
            )}
            {technicianName && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-heading font-bold">
                {technicianName}
              </span>
            )}
            {sop.ow_number && (
              <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-mono">
                {sop.ow_number}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
