import type { ParsedData } from '@/lib/fileParser';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface DataPreviewProps {
  parsed: ParsedData;
  onSheetChange?: (sheet: string) => void;
}

export default function DataPreview({ parsed, onSheetChange }: DataPreviewProps) {
  const previewRows = parsed.rows.slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">Datenvorschau</h3>
        <div className="flex items-center gap-3">
          {parsed.sheetNames && parsed.sheetNames.length > 1 && onSheetChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sheet:</span>
              <Select value={parsed.selectedSheet} onValueChange={onSheetChange}>
                <SelectTrigger className="h-7 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parsed.sheetNames.map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {parsed.rows.length} Zeilen · {parsed.headers.length} Spalten
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto max-h-[280px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left font-heading font-bold text-[10px] text-muted-foreground w-8">#</th>
              {parsed.headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left font-heading font-bold text-[10px] text-muted-foreground whitespace-nowrap max-w-[150px] truncate">
                  {h || `Sp.${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                {row.slice(0, parsed.headers.length).map((cell, j) => (
                  <td key={j} className="px-2 py-1 font-body truncate max-w-[150px]">{cell || '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
