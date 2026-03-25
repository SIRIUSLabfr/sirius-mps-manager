import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FileUploadZone from '@/components/import/FileUploadZone';
import DataPreview from '@/components/import/DataPreview';
import ColumnMapping from '@/components/import/ColumnMapping';
import {
  parseExcelFile, parseCsvFile, autoSuggestMapping, SOLL_TARGET_FIELD_LABELS,
  type ParsedData, type TargetField,
} from '@/lib/fileParser';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  locations: Tables<'locations'>[];
  existingDeviceCount: number;
  onImported: () => void;
}

export default function SollBulkImportDialog({ open, onOpenChange, projectId, locations, existingDeviceCount, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<Record<number, TargetField>>({});
  const [importing, setImporting] = useState(false);

  const handleFileSelected = useCallback(async (f: File) => {
    setFile(f);
    setProcessing(true);
    try {
      let result: ParsedData | null = null;
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        result = await parseExcelFile(f);
      } else if (ext.endsWith('.csv')) {
        result = await parseCsvFile(f);
      }
      if (result) {
        setParsed(result);
        setMapping(autoSuggestMapping(result.headers, 'soll'));
      }
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleClear = () => {
    setFile(null);
    setParsed(null);
    setMapping({});
  };

  const handleImport = async () => {
    if (!parsed || !projectId) return;
    setImporting(true);
    try {
      const locMap: Record<string, string> = {};
      locations.forEach(l => { locMap[l.name] = l.id; });

      const locationFieldIdx = Object.entries(mapping).find(([, v]) => v === 'location_name')?.[0];
      const newLocNames = new Set<string>();
      if (locationFieldIdx !== undefined) {
        parsed.rows.forEach(row => {
          const name = row[parseInt(locationFieldIdx)]?.trim();
          if (name && !locMap[name]) newLocNames.add(name);
        });
      }

      if (newLocNames.size > 0) {
        await supabase.from('locations').insert([...newLocNames].map(name => ({ project_id: projectId, name })));
        const { data: allLocs } = await supabase.from('locations').select('*').eq('project_id', projectId);
        allLocs?.forEach(l => { locMap[l.name] = l.id; });
      }

      let deviceNumber = existingDeviceCount + 1;
      const deviceRows: any[] = [];

      for (const row of parsed.rows) {
        const device: any = {
          project_id: projectId,
          device_number: deviceNumber++,
          preparation_status: 'pending',
          ist_source: 'import_soll',
        };
        Object.entries(mapping).forEach(([idxStr, target]) => {
          const val = row[parseInt(idxStr)]?.trim() || null;
          if (!val || target === 'ignore') return;
          if (target === 'location_name') {
            if (val && locMap[val]) device.location_id = locMap[val];
          } else {
            device[target] = val;
          }
        });
        deviceRows.push(device);
      }

      const BATCH = 50;
      for (let i = 0; i < deviceRows.length; i += BATCH) {
        const { error } = await supabase.from('devices').insert(deviceRows.slice(i, i + BATCH));
        if (error) throw error;
      }

      await supabase.from('file_imports').insert({
        project_id: projectId,
        file_name: parsed.fileName,
        file_type: parsed.sourceType === 'csv' ? 'csv' : 'excel',
        import_status: 'completed',
        row_count: parsed.rows.length,
        imported_device_count: deviceRows.length,
        column_mapping: mapping as any,
      });

      toast.success(`${deviceRows.length} SOLL-Geräte importiert`);
      onImported();
      onOpenChange(false);
      handleClear();
    } catch (err: any) {
      toast.error('Import-Fehler: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const mappedCount = Object.values(mapping).filter(v => v !== 'ignore').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">SOLL-Geräte Bulk Import</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FileUploadZone onFileSelected={handleFileSelected} acceptedFile={file} onClear={handleClear} isProcessing={processing} />

          {parsed && (
            <>
              <Separator />
              <DataPreview parsed={parsed} onSheetChange={parsed.sourceType === 'excel' ? async (sheet) => {
                setProcessing(true);
                try {
                  const result = await parseExcelFile(file!, sheet);
                  setParsed(result);
                  setMapping(autoSuggestMapping(result.headers, 'soll'));
                } finally { setProcessing(false); }
              } : undefined} />
              <Separator />
              <ColumnMapping
                sourceHeaders={parsed.headers}
                mapping={mapping}
                onMappingChange={(idx, field) => setMapping(prev => ({ ...prev, [idx]: field }))}
                previewRows={parsed.rows}
                fieldLabels={SOLL_TARGET_FIELD_LABELS}
              />
            </>
          )}
        </div>

        {parsed && (
          <DialogFooter className="mt-4">
            <div className="text-xs text-muted-foreground mr-auto">
              {parsed.rows.length} Zeilen · {mappedCount} Felder zugeordnet
            </div>
            <Button onClick={handleImport} disabled={importing || mappedCount === 0}>
              {importing ? 'Importiere...' : `${parsed.rows.length} SOLL-Geräte importieren`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
