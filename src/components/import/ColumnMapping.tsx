import type { TargetField } from '@/lib/fileParser';
import { TARGET_FIELD_LABELS } from '@/lib/fileParser';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnMappingProps {
  sourceHeaders: string[];
  mapping: Record<number, TargetField>;
  onMappingChange: (idx: number, field: TargetField) => void;
  previewRows: string[][];
  fieldLabels?: Record<string, string>;
}

const TARGET_FIELDS = Object.keys(TARGET_FIELD_LABELS) as TargetField[];

export default function ColumnMapping({ sourceHeaders, mapping, onMappingChange, previewRows }: ColumnMappingProps) {
  // Build mapped preview
  const mappedPreview = previewRows.slice(0, 3).map(row => {
    const mapped: Record<string, string> = {};
    sourceHeaders.forEach((_, idx) => {
      const target = mapping[idx];
      if (target && target !== 'ignore' && row[idx]) {
        mapped[target] = row[idx];
      }
    });
    return mapped;
  });

  const activeTargets = TARGET_FIELDS.filter(f => f !== 'ignore');

  return (
    <div className="space-y-6">
      {/* Mapping grid */}
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm">Spalten-Zuordnung</h3>
        <p className="text-xs text-muted-foreground">Ordne die Quellspalten den IST-Feldern zu. Nicht benötigte Spalten auf "ignorieren" setzen.</p>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_32px_1fr] gap-0 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Quell-Spalte</span>
            <span />
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Zielfeld</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/50">
            {sourceHeaders.map((header, idx) => {
              const target = mapping[idx] || 'ignore';
              const isMapped = target !== 'ignore';
              return (
                <div
                  key={idx}
                  className={cn(
                    'grid grid-cols-[1fr_32px_1fr] gap-0 px-4 py-2 items-center transition-colors',
                    isMapped ? 'bg-emerald-50/30' : ''
                  )}
                >
                  <span className={cn('text-sm font-body truncate', isMapped ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {header || `(Spalte ${idx + 1})`}
                  </span>
                  <ArrowRight className={cn('h-3.5 w-3.5 mx-auto', isMapped ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                  <Select value={target} onValueChange={(v) => onMappingChange(idx, v as TargetField)}>
                    <SelectTrigger className={cn('h-8 text-xs', isMapped ? 'border-emerald-300' : '')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">{TARGET_FIELD_LABELS[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mapped preview */}
      {mappedPreview.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-heading font-semibold text-sm">Vorschau der zugeordneten Daten</h3>
          <div className="bg-card border border-border rounded-lg overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {activeTargets.filter(f => mappedPreview.some(r => r[f])).map(f => (
                    <th key={f} className="px-3 py-2 text-left font-heading font-bold text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      {TARGET_FIELD_LABELS[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedPreview.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {activeTargets.filter(f => mappedPreview.some(r => r[f])).map(f => (
                      <td key={f} className="px-3 py-2 font-body truncate max-w-[200px]">{row[f] || '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
