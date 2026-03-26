import { formatDate } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { FileText, Clock } from 'lucide-react';

interface Version {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  versions: Version[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConceptVersionList({ versions, activeId, onSelect }: Props) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        <Clock className="h-3 w-3 inline mr-1" />Versionen:
      </span>
      {versions.map((v, i) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors',
            v.id === activeId
              ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
              : 'bg-card border-border text-muted-foreground hover:bg-muted/50',
          )}
        >
          <FileText className="h-3 w-3" />
          v{versions.length - i} ({formatDate(v.updated_at)})
        </button>
      ))}
    </div>
  );
}
