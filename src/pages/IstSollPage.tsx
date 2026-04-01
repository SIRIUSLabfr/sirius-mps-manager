import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useDevicesRealtime, useLocations } from '@/hooks/useRolloutData';
import { toast } from 'sonner';
import {
  parseExcelFile, parseCsvFile, parsePdfFile, autoSuggestMapping,
  type ParsedData, type TargetField,
} from '@/lib/fileParser';
import FileUploadZone from '@/components/import/FileUploadZone';
import DataPreview from '@/components/import/DataPreview';
import ColumnMapping from '@/components/import/ColumnMapping';
import ComparisonView from '@/components/istsoll/ComparisonView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Upload, AlertTriangle, CheckCircle2, ArrowLeftRight } from 'lucide-react';

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

  const [showSollDialog, setShowSollDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  // Stats
  const stats = useMemo(() => {
    if (!devices) return { ist: 0, soll: 0, mapped: 0, open: 0 };
    const ist = devices.filter(d => d.ist_manufacturer || d.ist_model).length;
    const sollOnly = devices.filter(d => (d.soll_manufacturer || d.soll_model) && !d.ist_manufacturer && !d.ist_model).length;
    const combined = devices.filter(d => (d.ist_manufacturer || d.ist_model) && (d.soll_manufacturer || d.soll_model)).length;
    const mappedViaId = devices.filter(d => d.mapped_to_device_id).length;
    const mapped = combined + mappedViaId;
    const soll = sollOnly + combined;
    const open = ist + sollOnly - mapped;
    return { ist, soll: soll + sollOnly, mapped, open };
  }, [devices]);

  const nextDeviceNumber = useMemo(() => (devices?.reduce((max, d) => Math.max(max, d.device_number || 0), 0) || 0) + 1, [devices]);

  const refreshDevices = () => {
    queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
    queryClient.invalidateQueries({ queryKey: ['locations', projectId] });
  };

  // IST Import handlers
  const handleFileSelected = useCallback(async (f: File) => {
    setFile(f);
    setProcessing(true);
    setPdfFailed(false);
    setParsed(null);
    try {
      let result: ParsedData | null = null;
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) result = await parseExcelFile(f);
      else if (ext.endsWith('.csv')) result = await parseCsvFile(f);
      else if (ext.endsWith('.pdf')) {
        result = await parsePdfFile(f);
        if (!result) { setPdfFailed(true); setProcessing(false); setImportStep('upload'); return; }
      }
      if (result) { setParsed(result); setMapping(autoSuggestMapping(result.headers)); setImportStep('preview'); }
    } catch (err: any) { toast.error('Fehler beim Lesen: ' + err.message); }
    finally { setProcessing(false); }
  }, []);

  const handleSheetChange = useCallback(async (sheet: string) => {
    if (!file) return;
    setProcessing(true);
    try { const result = await parseExcelFile(file, sheet); setParsed(result); setMapping(autoSuggestMapping(result.headers)); }
    catch (err: any) { toast.error('Fehler: ' + err.message); }
    finally { setProcessing(false); }
  }, [file]);

  const handleClear = () => { setFile(null); setParsed(null); setPdfFailed(false); setMapping({}); setImportStep('upload'); };

  const handleImport = async () => {
    if (!parsed || !projectId) return;
    setImporting(true);
    try {
      const locationFieldIdx = Object.entries(mapping).find(([, v]) => v === 'location_name')?.[0];
      const locationNames = new Set<string>();
      parsed.rows.forEach(row => {
        if (locationFieldIdx !== undefined) {
          const n = row[parseInt(locationFieldIdx)]?.trim();
          if (n) locationNames.add(n);
        }
      });
      const existingLocNames = new Set(locations?.map(l => l.name) || []);
      const newLocs = [...locationNames].filter(n => !existingLocNames.has(n));
      if (newLocs.length > 0) {
        await supabase.from('locations').insert(newLocs.map(name => ({ project_id: projectId, name })));
        await queryClient.invalidateQueries({ queryKey: ['locations', projectId] });
      }
      const { data: allLocations } = await supabase.from('locations').select('*').eq('project_id', projectId);
      const locMap: Record<string, string> = {};
      allLocations?.forEach(l => { locMap[l.name] = l.id; });

      let dn = nextDeviceNumber;
      const deviceRows: any[] = [];
      for (const row of parsed.rows) {
        const device: any = { project_id: projectId, device_number: dn++, preparation_status: 'pending', ist_source: parsed.sourceType === 'csv' ? 'import_csv' : parsed.sourceType === 'pdf' ? 'import_pdf' : 'import_excel' };
        Object.entries(mapping).forEach(([idxStr, target]) => {
          const val = row[parseInt(idxStr)]?.trim() || null;
          if (!val || target === 'ignore') return;
          if (target === 'location_name') { if (val && locMap[val]) device.location_id = locMap[val]; }
          else device[target] = val;
        });
        deviceRows.push(device);
      }
      for (let i = 0; i < deviceRows.length; i += 50) {
        const { error } = await supabase.from('devices').insert(deviceRows.slice(i, i + 50));
        if (error) throw error;
      }
      await supabase.from('file_imports').insert({ project_id: projectId, file_name: parsed.fileName, file_type: parsed.sourceType === 'csv' ? 'csv' : parsed.sourceType === 'pdf' ? 'pdf' : 'excel', import_status: 'completed', row_count: parsed.rows.length, imported_device_count: deviceRows.length, column_mapping: mapping as any });
      refreshDevices();
      toast.success(`${deviceRows.length} IST-Geräte importiert`);
      setImportStep('done');
    } catch (err: any) { toast.error('Import-Fehler: ' + err.message); }
    finally { setImporting(false); }
  };

  const mappedFieldCount = Object.values(mapping).filter(v => v !== 'ignore').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">IST/SOLL Vergleich</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'IST-Geräte gesamt', value: stats.ist, accent: 'border-t-primary' },
          { label: 'SOLL-Geräte gesamt', value: stats.soll, accent: 'border-t-secondary' },
          { label: 'Zugeordnet', value: stats.mapped, accent: 'border-t-emerald-500' },
          { label: 'Offen', value: stats.open, accent: 'border-t-amber-500' },
        ].map(s => (
          <div key={s.label} className={`bg-card border border-border rounded-lg px-4 py-3 border-t-[3px] ${s.accent}`}>
            <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-heading font-extrabold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* SOLL Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> SOLL-Geräte anlegen
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-heading" onClick={() => setShowBulkImport(true)}>
                <FileUp className="h-3.5 w-3.5" /> Bulk Import
              </Button>
              <Button size="sm" className="gap-1.5 text-xs font-heading" onClick={() => setShowSollDialog(true)}>
                <Plus className="h-3.5 w-3.5" /> SOLL-Gerät hinzufügen
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* IST Import */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> IST-Bestandsliste importieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileUploadZone onFileSelected={handleFileSelected} acceptedFile={file} onClear={handleClear} isProcessing={processing} />

          {pdfFailed && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-semibold text-sm text-amber-800">PDF konnte nicht als Tabelle erkannt werden</p>
                <p className="text-xs text-amber-700 mt-1">Bitte exportiere die Bestandsliste als Excel (.xlsx) oder CSV (.csv).</p>
              </div>
            </div>
          )}

          {parsed && importStep !== 'done' && (
            <>
              <Separator />
              <DataPreview parsed={parsed} onSheetChange={parsed.sourceType === 'excel' ? handleSheetChange : undefined} />
              <Separator />
              <ColumnMapping sourceHeaders={parsed.headers} mapping={mapping} onMappingChange={(idx, field) => setMapping(prev => ({ ...prev, [idx]: field }))} previewRows={parsed.rows} />
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-sm font-body text-muted-foreground">
                  <span className="font-semibold text-foreground">{parsed.rows.length}</span> Zeilen · <span className="font-semibold text-foreground">{mappedFieldCount}</span> Felder zugeordnet
                </div>
                <Button onClick={handleImport} disabled={importing || mappedFieldCount === 0} className="gap-2 font-heading">
                  {importing ? 'Importiere...' : `${parsed.rows.length} Geräte importieren`}
                </Button>
              </div>
            </>
          )}

          {importStep === 'done' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-heading font-semibold text-sm text-emerald-800">Import abgeschlossen</p>
                <p className="text-xs text-emerald-700 mt-1">Die IST-Geräte wurden erfolgreich importiert.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear} className="ml-auto font-heading text-xs">Weiteren Import</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison View */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> IST ↔ SOLL Zuordnung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices && devices.length > 0 ? (
            <ComparisonView devices={devices} locations={locations || []} projectId={projectId!} onRefresh={refreshDevices} />
          ) : (
            <div className="h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <span className="text-muted-foreground text-sm">Importiere zuerst IST- oder SOLL-Geräte, um die Zuordnung zu starten.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NewSollDeviceDialog
        open={showSollDialog}
        onOpenChange={setShowSollDialog}
        projectId={projectId!}
        locations={locations || []}
        onCreated={refreshDevices}
        nextDeviceNumber={nextDeviceNumber}
      />
      <SollBulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        projectId={projectId!}
        locations={locations || []}
        existingDeviceCount={nextDeviceNumber - 1}
        onImported={refreshDevices}
      />
    </div>
  );
}
