import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, FileText, File as FileIcon, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  acceptedFile: File | null;
  onClear: () => void;
  isProcessing: boolean;
}

const ACCEPTED = '.xlsx,.xls,.csv,.pdf';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(name: string) {
  if (name.endsWith('.csv')) return FileText;
  if (name.endsWith('.pdf')) return FileIcon;
  return FileSpreadsheet;
}

function getTypeBadge(name: string) {
  if (name.endsWith('.csv')) return { label: 'CSV', variant: 'secondary' as const };
  if (name.endsWith('.pdf')) return { label: 'PDF', variant: 'destructive' as const };
  return { label: 'Excel', variant: 'default' as const };
}

export default function FileUploadZone({ onFileSelected, acceptedFile, onClear, isProcessing }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  }, [onFileSelected]);

  if (acceptedFile) {
    const Icon = getFileIcon(acceptedFile.name);
    const badge = getTypeBadge(acceptedFile.name);
    return (
      <div className="border border-border rounded-lg p-4 bg-card flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-heading font-semibold text-sm truncate">{acceptedFile.name}</p>
            <Badge variant={badge.variant} className="text-[10px] shrink-0">{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatSize(acceptedFile.size)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing ? (
            <span className="text-xs text-muted-foreground animate-pulse">Wird verarbeitet...</span>
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
          <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <Upload className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="font-heading font-semibold text-sm">Datei hierher ziehen oder klicken</p>
        <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls), CSV (.csv) oder PDF (.pdf)</p>
      </div>
      <input type="file" accept={ACCEPTED} onChange={handleChange} className="hidden" />
    </label>
  );
}
