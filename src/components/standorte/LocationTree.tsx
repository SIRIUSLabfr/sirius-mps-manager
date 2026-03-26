import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2, Layers, MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocationNode } from '@/hooks/useLocationData';
import { Button } from '@/components/ui/button';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface LocationTreeProps {
  tree: LocationNode[];
  selectedId: string | null;
  onSelect: (node: LocationNode) => void;
  onAdd: (parentId: string | null, type: 'site' | 'building' | 'floor') => void;
  onEdit: (node: LocationNode) => void;
  onDelete: (node: LocationNode) => void;
}

const typeIcon = (t: string) => {
  if (t === 'building') return Building2;
  if (t === 'floor') return Layers;
  return MapPin;
};

const typeLabel = (t: string) => {
  if (t === 'building') return 'Gebäude';
  if (t === 'floor') return 'Stockwerk';
  return 'Standort';
};

function TreeNode({
  node, depth, selectedId, onSelect, onAdd, onEdit, onDelete,
}: {
  node: LocationNode; depth: number;
} & Omit<LocationTreeProps, 'tree'>) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length || 0) > 0;
  const Icon = typeIcon(node.location_type);
  const isSelected = selectedId === node.id;

  const childType = node.location_type === 'site' ? 'building' : node.location_type === 'building' ? 'floor' : null;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors group',
              isSelected
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-muted text-foreground',
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={() => {
              onSelect(node);
              if (hasChildren) setExpanded(!expanded);
            }}
          >
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
            <span className="truncate flex-1">{node.name}</span>
            <span className="text-[10px] text-muted-foreground/60 font-heading uppercase hidden group-hover:inline">
              {typeLabel(node.location_type)}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {childType && (
            <ContextMenuItem onClick={() => onAdd(node.id, childType)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              {childType === 'building' ? 'Gebäude hinzufügen' : 'Stockwerk hinzufügen'}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onEdit(node)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Bearbeiten
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(node)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Löschen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && node.children?.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function LocationTree({ tree, selectedId, onSelect, onAdd, onEdit, onDelete }: LocationTreeProps) {
  return (
    <div className="space-y-0.5">
      {tree.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Standorte angelegt.
        </div>
      )}
      {tree.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-muted-foreground"
        onClick={() => onAdd(null, 'site')}
      >
        <Plus className="h-4 w-4 mr-2" />
        Standort hinzufügen
      </Button>
    </div>
  );
}
