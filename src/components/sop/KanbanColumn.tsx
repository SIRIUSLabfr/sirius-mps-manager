import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import SopCard from './SopCard';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  id: string;
  title: string;
  color: string;
  items: Tables<'sop_orders'>[];
  getUserName: (id: string | null) => string | undefined;
  getProjectType?: (projectId: string) => string;
  onCardClick: (sop: Tables<'sop_orders'>) => void;
}

export default function KanbanColumn({ id, title, color, items, getUserName, getProjectType, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 border-border', color)}>
        <h3 className="text-xs font-heading font-bold uppercase tracking-wide">{title}</h3>
        <span className="ml-auto text-[10px] font-heading font-bold bg-background/50 px-1.5 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 space-y-2 border border-border rounded-b-lg min-h-[200px] transition-colors overflow-y-auto max-h-[calc(100vh-340px)]',
          isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/20'
        )}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(sop => (
            <SopCard
              key={sop.id}
              sop={sop}
              technicianName={getUserName(sop.technician)}
              projectType={getProjectType?.(sop.project_id)}
              onClick={() => onCardClick(sop)}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground">Keine Einträge</div>
        )}
      </div>
    </div>
  );
}
