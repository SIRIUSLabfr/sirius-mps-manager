import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime, useLocations } from '@/hooks/useRolloutData';
import { toast } from 'sonner';
import {
  parseExcelFile, parseCsvFile, parsePdfFile, autoSuggestMapping,
  type ParsedData, type TargetField, TARGET_FIELD_LABELS,
} from '@/lib/fileParser';
import FileUploadZone from '@/components/import/FileUploadZone';
import DataPreview from '@/components/import/DataPreview';
import ColumnMapping from '@/components/import/ColumnMapping';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function IstSollPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { data: devices } = useDevicesRealtime(projectId || null);
  const { data: locations } = useLocations(projectId || null);
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [mapping, setMapping] = useState<Record<number, TargetField>>({});
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'mapping' | 'done'>('upload');

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const handleFileSelected = useCallback(async (f: File) => {
    setFile(f);
    setProcessing(true);
    setPdfFailed(false);
    setParsed(null);

    try {
      let result: ParsedData | null = null;
      const ext = f.name.toLowerCase();

      if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        result = await parseExcelFile(f);
      } else if (ext.endsWith('.csv')) {
        result = await parseCsvFile(f);
      } else if (ext.endsWith('.pdf')) {
        result = await parsePdfFile(f);
        if (!result) {
          setPdfFailed(true);
          setProcessing(false);
          setImportStep('upload');
          return;
        }
      }

      if (result) {
        setParsed(result);
        const autoMap = autoSuggestMapping(result.headers);
        setMapping(autoMap);
        setImportStep('preview');
      }
    } catch (err: any) {
      toast.error('Fehler beim Lesen: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleSheetChange = useCallback(async (sheet: string) => {
    if (!file) return;
    setProcessing(true);
    try {
      const result = await parseExcelFile(file, sheet);
      setParsed(result);
      setMapping(autoSuggestMapping(result.headers));
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }, [file]);

  const handleClear = () => {
    setFile(null);
    setParsed(null);
    setPdfFailed(false);
    setMapping({});
    setImportStep('upload');
  };

  const handleMappingChange = (idx: number, field: TargetField) => {
    setMapping(prev => ({ ...prev, [idx]: field }));
  };

  const handleImport = async () => {
    if (!parsed || !projectId) return;
    setImporting(true);

    try {
      const deviceRows: any[] = [];
      const locationNames = new Set<string>();

      // Collect location names first
      const locationFieldIdx = Object.entries(mapping).find(([, v]) => v === 'location_name')?.[0];

      parsed.rows.forEach(row => {
        if (locationFieldIdx !== undefined) {
          const locName = row[parseInt(locationFieldIdx)]?.trim();
          if (locName) locationNames.add(locName);
        }
      });

      // Create missing locations
      const existingLocNames = new Set(locations?.map(l => l.name) || []);
      const newLocations = [...locationNames].filter(n => !existingLocNames.has(n));

      if (newLocations.length > 0) {
        const { error: locErr } = await supabase.from('locations').insert(
          newLocations.map(name => ({ project_id: projectId, name }))
        );
        if (locErr) throw locErr;
        await queryClient.invalidateQueries({ queryKey: ['locations', projectId] });
      }

      // Refresh locations
      const { data: allLocations } = await supabase
        .from('locations')
        .select('*')
        .eq('project_id', projectId);
      const locMap: Record<string, string> = {};
      allLocations?.forEach(l => { locMap[l.name] = l.id; });

      // Build device rows
      let deviceNumber = (devices?.reduce((max, d) => Math.max(max, d.device_number || 0), 0) || 0) + 1;

      for (const row of parsed.rows) {
        const device: any = {
          project_id: projectId,
          device_number: deviceNumber++,
          preparation_status: 'pending',
          ist_source: parsed.sourceType === 'csv' ? 'import_csv' : parsed.sourceType === 'pdf' ? 'import_pdf' : 'import_excel',
        };

        Object.entries(mapping).forEach(([idxStr, target]) => {
          const idx = parseInt(idxStr);
          const val = row[idx]?.trim() || null;
          if (!val || target === 'ignore') return;

          if (target === 'location_name') {
            if (val && locMap[val]) device.location_id = locMap[val];
          } else {
            device[target] = val;
          }
        });

        deviceRows.push(device);
      }

      // Insert devices in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < deviceRows.length; i += BATCH_SIZE) {
        const batch = deviceRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('devices').insert(batch);
        if (error) throw error;
      }

      // Save import metadata
      await supabase.from('file_imports').insert({
        project_id: projectId,
        file_name: parsed.fileName,
        file_type: parsed.sourceType === 'csv' ? 'csv' : parsed.sourceType === 'pdf' ? 'pdf' : 'excel',
        import_status: 'completed',
        row_count: parsed.rows.length,
        imported_device_count: deviceRows.length,
        column_mapping: mapping as any,
      });

      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      toast.success(`${deviceRows.length} IST-Geräte importiert`);
      setImportStep('done');
    } catch (err: any) {
      toast.error('Import-Fehler: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const mappedFieldCount = Object.values(mapping).filter(v => v !== 'ignore').length;

  // Summary stats
  const totalIst = devices?.filter(d => d.ist_manufacturer || d.ist_model).length || 0;
  const totalSoll = devices?.filter(d => d.soll_manufacturer || d.soll_model).length || 0;
  const totalMapped = devices?.filter(d => (d.ist_manufacturer || d.ist_model) && (d.soll_manufacturer || d.soll_model)).length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">IST/SOLL Vergleich</h1>

      {/* Summary chips */}
      <div className="flex gap-4">
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">IST-Geräte</p>
          <p className="text-xl font-heading font-extrabold text-foreground">{totalIst}</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">SOLL-Geräte</p>
          <p className="text-xl font-heading font-extrabold text-foreground">{totalSoll}</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">Zugeordnet</p>
          <p className="text-xl font-heading font-extrabold text-emerald-600">{totalMapped}</p>
        </div>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            IST-Bestandsliste importieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Upload */}
          <FileUploadZone
            onFileSelected={handleFileSelected}
            acceptedFile={file}
            onClear={handleClear}
            isProcessing={processing}
          />

          {/* PDF failure notice */}
          {pdfFailed && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-semibold text-sm text-amber-800">PDF konnte nicht als Tabelle erkannt werden</p>
                <p className="text-xs text-amber-700 mt-1">
                  Die PDF-Datei enthält keine erkennbare Tabellenstruktur. Bitte exportiere die Bestandsliste als Excel (.xlsx) oder CSV (.csv) und versuche es erneut.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {parsed && importStep !== 'done' && (
            <>
              <Separator />
              <DataPreview parsed={parsed} onSheetChange={parsed.sourceType === 'excel' ? handleSheetChange : undefined} />
            </>
          )}

          {/* Step 3: Mapping */}
          {parsed && importStep !== 'done' && (
            <>
              <Separator />
              <ColumnMapping
                sourceHeaders={parsed.headers}
                mapping={mapping}
                onMappingChange={handleMappingChange}
                previewRows={parsed.rows}
              />
            </>
          )}

          {/* Step 4: Import button */}
          {parsed && importStep !== 'done' && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-sm font-body text-muted-foreground">
                  <span className="font-semibold text-foreground">{parsed.rows.length}</span> Zeilen erkannt ·{' '}
                  <span className="font-semibold text-foreground">{mappedFieldCount}</span> Felder zugeordnet
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importing || mappedFieldCount === 0}
                  className="gap-2 font-heading"
                >
                  {importing ? 'Importiere...' : `${parsed.rows.length} Geräte importieren`}
                </Button>
              </div>
            </>
          )}

          {/* Done state */}
          {importStep === 'done' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-heading font-semibold text-sm text-emerald-800">Import abgeschlossen</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Die IST-Geräte wurden erfolgreich importiert. Du kannst sie in der Rolloutliste einsehen.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear} className="ml-auto font-heading text-xs">
                Weiteren Import starten
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for SOLL comparison view */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">IST ↔ SOLL Zuordnung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
            <span className="text-muted-foreground text-sm">Die IST/SOLL-Zuordnungsansicht wird in einem späteren Schritt implementiert.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
