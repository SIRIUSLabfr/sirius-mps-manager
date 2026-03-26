import { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronDown,
  Upload,
  ArrowRight,
  Database,
  FileSpreadsheet,
  Loader2,
  ArrowDownToLine,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DeviceGroup } from './DeviceGroupCard';
import { calcGroupEk } from './DeviceGroupCard';

interface IstDevice {
  id: string;
  manufacturer: string;
  model: string;
  location: string;
  floor?: string;
  room?: string;
  serial?: string;
  quantity: number;
  monthly_rate?: number;
  volume_bw?: number;
  volume_color?: number;
}

interface Props {
  projectId: string;
  deviceGroups: DeviceGroup[];
  totalRate: number;
}

const IST_FIELD_OPTIONS = [
  { value: 'skip', label: '– Überspringen –' },
  { value: 'manufacturer', label: 'Hersteller' },
  { value: 'model', label: 'Modell' },
  { value: 'location', label: 'Standort' },
  { value: 'floor', label: 'Etage' },
  { value: 'room', label: 'Raum' },
  { value: 'serial', label: 'Seriennummer' },
  { value: 'monthly_rate', label: 'Monatl. Rate' },
  { value: 'volume_bw', label: 'Volumen S/W' },
  { value: 'volume_color', label: 'Volumen Farbe' },
];

export default function IstBestandsAnalyse({ projectId, deviceGroups, totalRate }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch existing IST devices from rollout
  const { data: existingDevices = [] } = useQuery({
    queryKey: ['ist-devices-kalk', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('project_id', projectId)
        .or('ist_manufacturer.not.is.null,ist_model.not.is.null')
        .order('device_number');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Local IST list (imported in kalkulation context)
  const [istDevices, setIstDevices] = useState<IstDevice[]>([]);

  // Aggregate IST devices by manufacturer+model+location
  const aggregatedIst = useMemo(() => {
    const source = istDevices.length > 0 ? istDevices : existingDevices.map(d => ({
      id: d.id,
      manufacturer: d.ist_manufacturer || '',
      model: d.ist_model || '',
      location: d.ist_building || d.ist_floor || '',
      floor: d.ist_floor || '',
      room: d.ist_room || '',
      serial: d.ist_serial || '',
      quantity: 1,
      monthly_rate: undefined as number | undefined,
      volume_bw: undefined as number | undefined,
      volume_color: undefined as number | undefined,
    }));

    const grouped = new Map<string, IstDevice & { count: number }>();
    source.forEach(d => {
      const key = `${d.manufacturer}|${d.model}|${d.location}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += d.quantity || 1;
        if (d.monthly_rate) existing.monthly_rate = (existing.monthly_rate || 0) + d.monthly_rate;
        if (d.volume_bw) existing.volume_bw = (existing.volume_bw || 0) + d.volume_bw;
        if (d.volume_color) existing.volume_color = (existing.volume_color || 0) + d.volume_color;
      } else {
        grouped.set(key, { ...d, count: d.quantity || 1 });
      }
    });
    return [...grouped.values()];
  }, [istDevices, existingDevices]);

  // SOLL options from device groups for dropdown
  const sollOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: '__none__', label: '– kein Gerät –' },
      { value: '__removed__', label: 'Entfällt' },
    ];
    deviceGroups.forEach((g, i) => {
      if (g.mainDevice) {
        opts.push({
          value: String(i),
          label: `${g.mainDevice.name}${g.label ? ` (${g.label})` : ''} – ${g.mainQuantity}×`,
        });
      }
    });
    return opts;
  }, [deviceGroups]);

  // Track SOLL assignment per IST row
  const [sollAssignments, setSollAssignments] = useState<Record<string, string>>({});

  const totalIst = aggregatedIst.reduce((s, d) => s + d.count, 0);
  const istMonthlyRate = aggregatedIst.reduce((s, d) => s + (d.monthly_rate || 0), 0);

  const hasData = aggregatedIst.length > 0 || existingDevices.length > 0;

  // File parsing
  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setParsedHeaders(result.meta.fields || []);
          setParsedData(result.data as Record<string, string>[]);
          autoMapColumns(result.meta.fields || []);
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        const headers = json.length > 0 ? Object.keys(json[0]) : [];
        setParsedHeaders(headers);
        setParsedData(json);
        autoMapColumns(headers);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Bitte CSV oder Excel-Datei verwenden');
    }
  }, []);

  const autoMapColumns = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const patterns: Record<string, RegExp> = {
      manufacturer: /hersteller|manufacturer|marke|brand/i,
      model: /modell|model|typ|type|gerät|device/i,
      location: /standort|location|adresse|address|gebäude|building/i,
      floor: /etage|floor|stockwerk|og|ug/i,
      room: /raum|room|zimmer/i,
      serial: /serie|serial|sn/i,
      monthly_rate: /rate|monat|monthly|kosten|cost/i,
      volume_bw: /s.?w|schwarz|black|mono/i,
      volume_color: /farb|color|colour/i,
    };
    headers.forEach(h => {
      for (const [field, regex] of Object.entries(patterns)) {
        if (regex.test(h) && !Object.values(mapping).includes(field)) {
          mapping[h] = field;
          break;
        }
      }
    });
    setColumnMapping(mapping);
  };

  const handleImport = () => {
    setImporting(true);
    try {
      const devices: IstDevice[] = parsedData.map((row, i) => {
        const get = (field: string) => {
          const col = Object.entries(columnMapping).find(([_, v]) => v === field)?.[0];
          return col ? (row[col] || '').toString().trim() : '';
        };
        const parseNum = (field: string) => {
          const v = get(field).replace(',', '.');
          return v ? parseFloat(v) || 0 : undefined;
        };
        return {
          id: crypto.randomUUID(),
          manufacturer: get('manufacturer'),
          model: get('model'),
          location: get('location'),
          floor: get('floor'),
          room: get('room'),
          serial: get('serial'),
          quantity: 1,
          monthly_rate: parseNum('monthly_rate'),
          volume_bw: parseNum('volume_bw'),
          volume_color: parseNum('volume_color'),
        };
      }).filter(d => d.manufacturer || d.model);

      setIstDevices(devices);
      setImportOpen(false);
      setParsedData([]);
      setParsedHeaders([]);
      setOpen(true);
      toast.success(`${devices.length} IST-Geräte importiert`);
    } catch (err) {
      toast.error('Importfehler');
    }
    setImporting(false);
  };

  const handleUseExisting = () => {
    setIstDevices([]);
    setOpen(true);
  };

  const handleTransferToRollout = async () => {
    if (istDevices.length === 0) return;
    setTransferring(true);
    try {
      const inserts = istDevices.map((d, i) => ({
        project_id: projectId,
        device_number: i + 1,
        ist_manufacturer: d.manufacturer,
        ist_model: d.model,
        ist_serial: d.serial || null,
        ist_building: d.location || null,
        ist_floor: d.floor || null,
        ist_room: d.room || null,
        ist_source: 'kalkulation_import',
      }));
      const { error } = await supabase.from('devices').insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['ist-devices-kalk', projectId] });
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      toast.success(`${inserts.length} Geräte in Rolloutliste übernommen`);
      setIstDevices([]);
    } catch (err: any) {
      toast.error('Fehler: ' + (err?.message || 'Unbekannt'));
    }
    setTransferring(false);
  };

  const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="border-l-4 border-l-primary/60">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="font-heading text-base">IST-Bestandsanalyse</CardTitle>
                  {hasData && (
                    <Badge variant="secondary" className="text-[10px]">
                      {totalIst} Geräte
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/15 rounded-lg text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Importiere die aktuelle Geräteliste des Kunden (vom bisherigen MPS-Anbieter),
                  um Einsparpotenziale zu berechnen.
                </p>
              </div>

              {/* Import actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="gap-2 text-xs font-heading"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" /> IST-Liste importieren
                </Button>
                {existingDevices.length > 0 && istDevices.length === 0 && (
                  <Button
                    variant="outline"
                    className="gap-2 text-xs font-heading border-secondary/40 text-secondary"
                    onClick={handleUseExisting}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {existingDevices.length} IST-Geräte aus Rolloutliste verwenden
                  </Button>
                )}
              </div>

              {/* Comparison Table */}
              {hasData && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-3 py-2 text-left">
                          <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-primary">IST (Altgerät)</span>
                        </th>
                        <th className="px-2 py-2 text-center w-10">
                          <ArrowRight className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                        </th>
                        <th className="px-3 py-2 text-left">
                          <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-secondary">SOLL (Neugerät)</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {aggregatedIst.map((ist, i) => {
                        const key = ist.id || String(i);
                        const assigned = sollAssignments[key] || '__none__';
                        return (
                          <tr key={key} className="hover:bg-muted/20">
                            <td className="px-3 py-2">
                              <span className="font-medium">{ist.manufacturer} {ist.model}</span>
                              {ist.location && (
                                <span className="text-muted-foreground ml-1">({ist.location})</span>
                              )}
                              <span className="text-muted-foreground ml-1">{ist.count}×</span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <ArrowRight className="h-3 w-3 mx-auto text-muted-foreground/50" />
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                value={assigned}
                                onValueChange={(v) => setSollAssignments(prev => ({ ...prev, [key]: v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {sollOptions.map(o => (
                                    <SelectItem key={o.value} value={o.value} className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary */}
              {hasData && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-[10px] font-heading uppercase text-muted-foreground">IST Geräte</p>
                    <p className="text-lg font-bold">{totalIst}</p>
                  </div>
                  {istMonthlyRate > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <p className="text-[10px] font-heading uppercase text-muted-foreground">IST Rate gesamt</p>
                      <p className="text-lg font-bold">{fmtNum(istMonthlyRate)} €</p>
                    </div>
                  )}
                </div>
              )}

              {/* Transfer button */}
              {istDevices.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-xs font-heading border-secondary/40"
                  onClick={handleTransferToRollout}
                  disabled={transferring}
                >
                  {transferring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  )}
                  IST-Daten in Rolloutliste übernehmen
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">IST-Geräteliste importieren</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File upload */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">CSV oder Excel-Datei hierher ziehen</p>
              <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            {/* Column mapping */}
            {parsedHeaders.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-heading uppercase tracking-wider">Spalten-Zuordnung</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {parsedHeaders.map(h => (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-xs font-mono truncate w-32 shrink-0" title={h}>{h}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Select
                          value={columnMapping[h] || 'skip'}
                          onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [h]: v }))}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IST_FIELD_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-1.5">
                    <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                      Vorschau ({parsedData.length} Zeilen)
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          {parsedHeaders.slice(0, 6).map(h => (
                            <th key={h} className="px-2 py-1 text-left text-muted-foreground font-normal truncate max-w-[120px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {parsedData.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {parsedHeaders.slice(0, 6).map(h => (
                              <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {parsedData.length} Geräte importieren
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
