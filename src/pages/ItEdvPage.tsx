import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Monitor, ScanLine, Package, GraduationCap, StickyNote, ChevronDown } from 'lucide-react';

interface ItConfig {
  it_contact_internal: string | null;
  it_contact_external: string | null;
  external_it_company: string | null;
  scan_methods: string[] | null;
  scan_smb_server: string | null;
  scan_smb_user: string | null;
  scan_smb_shared: boolean | null;
  scan_smtp_server: string | null;
  scan_smtp_port: string | null;
  scan_smtp_auth: boolean | null;
  scan_smtp_sender: string | null;
  scan_ftp_server: string | null;
  scan_ftp_path: string | null;
  scan_ftp_user: string | null;
  software_fleet_server: string | null;
  software_fleet_proxy: string | null;
  software_scan_name: string | null;
  software_scan_server: string | null;
  software_print_name: string | null;
  software_print_server: string | null;
  software_followme_system: string | null;
  software_followme_server: string | null;
  card_reader_type: string | null;
  training_type: string[] | null;
  it_notes: string | null;
  software_notes: string | null;
}

const EMPTY_CONFIG: ItConfig = {
  it_contact_internal: '', it_contact_external: '', external_it_company: '',
  scan_methods: [], scan_smb_server: '', scan_smb_user: '', scan_smb_shared: false,
  scan_smtp_server: '', scan_smtp_port: '', scan_smtp_auth: false, scan_smtp_sender: '',
  scan_ftp_server: '', scan_ftp_path: '', scan_ftp_user: '',
  software_fleet_server: '', software_fleet_proxy: '',
  software_scan_name: '', software_scan_server: '',
  software_print_name: '', software_print_server: '',
  software_followme_system: '', software_followme_server: '', card_reader_type: '',
  training_type: [], it_notes: '', software_notes: '',
};

const SCAN_METHODS = [
  { value: 'smb', label: 'Ordner / SMB' },
  { value: 'smtp', label: 'E-Mail / SMTP' },
  { value: 'ftp', label: 'FTP' },
  { value: 'usb', label: 'USB' },
  { value: 'none', label: 'Nicht relevant' },
];

const SOFTWARE_OPTIONS = [
  { value: 'fleet', label: 'Fleet Management' },
  { value: 'scan', label: 'Scansoftware' },
  { value: 'print', label: 'Drucksoftware' },
  { value: 'followme', label: 'Follow Me / Pull-Print' },
];

const TRAINING_OPTIONS = [
  { value: 'per_device', label: 'Pro Gerät' },
  { value: 'per_floor', label: 'Pro Stockwerk' },
  { value: 'per_location', label: 'Pro Standort' },
  { value: 'group', label: 'Sammeleinweisung' },
  { value: 'none', label: 'Keine Einweisung nötig' },
];

const FOLLOWME_SYSTEMS = ['PaperCut', 'uniFLOW', 'YSoft SafeQ', 'Ricoh Streamline NX', 'Sonstige'];
const CARD_READERS = ['Mifare Classic', 'DESFire EV1', 'DESFire EV3', 'HID iClass', 'Sonstige'];

export default function ItEdvPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ItConfig>(EMPTY_CONFIG);
  const [configId, setConfigId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [activeSoftware, setActiveSoftware] = useState<string[]>([]);

  useEffect(() => { if (projectId) setActiveProjectId(projectId); }, [projectId, setActiveProjectId]);

  const { data: existing } = useQuery({
    queryKey: ['it_config', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase.from('it_config').select('*').eq('project_id', projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (existing) {
      setConfigId(existing.id);
      setConfig({
        it_contact_internal: existing.it_contact_internal || '',
        it_contact_external: existing.it_contact_external || '',
        external_it_company: existing.external_it_company || '',
        scan_methods: existing.scan_methods || [],
        scan_smb_server: existing.scan_smb_server || '',
        scan_smb_user: existing.scan_smb_user || '',
        scan_smb_shared: existing.scan_smb_shared || false,
        scan_smtp_server: existing.scan_smtp_server || '',
        scan_smtp_port: existing.scan_smtp_port || '',
        scan_smtp_auth: existing.scan_smtp_auth || false,
        scan_smtp_sender: existing.scan_smtp_sender || '',
        scan_ftp_server: existing.scan_ftp_server || '',
        scan_ftp_path: existing.scan_ftp_path || '',
        scan_ftp_user: existing.scan_ftp_user || '',
        software_fleet_server: existing.software_fleet_server || '',
        software_fleet_proxy: existing.software_fleet_proxy || '',
        software_scan_name: existing.software_scan_name || '',
        software_scan_server: existing.software_scan_server || '',
        software_print_name: existing.software_print_name || '',
        software_print_server: existing.software_print_server || '',
        software_followme_system: existing.software_followme_system || '',
        software_followme_server: existing.software_followme_server || '',
        card_reader_type: existing.card_reader_type || '',
        training_type: existing.training_type || [],
        it_notes: existing.it_notes || '',
        software_notes: existing.software_notes || '',
      });
      // Derive active software from existing data
      const sw: string[] = [];
      if (existing.software_fleet_server) sw.push('fleet');
      if (existing.software_scan_name || existing.software_scan_server) sw.push('scan');
      if (existing.software_print_name || existing.software_print_server) sw.push('print');
      if (existing.software_followme_system || existing.software_followme_server) sw.push('followme');
      setActiveSoftware(sw);
    }
  }, [existing]);

  const autoSave = useCallback((updated: ItConfig) => {
    if (!projectId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (configId) {
          const { error } = await supabase.from('it_config').update(updated).eq('id', configId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('it_config').insert({ ...updated, project_id: projectId }).select('id').single();
          if (error) throw error;
          setConfigId(data.id);
        }
        queryClient.invalidateQueries({ queryKey: ['it_config', projectId] });
      } catch {
        toast.error('Speichern fehlgeschlagen');
      }
    }, 800);
  }, [projectId, configId, queryClient]);

  const update = (field: keyof ItConfig, value: any) => {
    const updated = { ...config, [field]: value };
    setConfig(updated);
    autoSave(updated);
  };

  const toggleArrayValue = (field: 'scan_methods' | 'training_type', value: string) => {
    const arr = config[field] || [];
    const updated = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    update(field, updated);
  };

  const toggleSoftware = (value: string) => {
    setActiveSoftware(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const hasScan = (method: string) => (config.scan_methods || []).includes(method);
  const hasTraining = (type: string) => (config.training_type || []).includes(type);

  const Field = ({ label, field, value, type = 'text' }: { label: string; field: keyof ItConfig; value: string; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      {type === 'textarea' ? (
        <Textarea value={value} onChange={e => update(field, e.target.value)} className="text-sm min-h-[80px]" />
      ) : (
        <Input value={value} onChange={e => update(field, e.target.value)} type={type} className="text-sm h-9" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">IT / EDV Konfiguration</h1>

      {/* Card 1: IT Contacts */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> IT Ansprechpartner</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Interner IT-Ansprechpartner" field="it_contact_internal" value={config.it_contact_internal || ''} />
          <Field label="Externer IT-Dienstleister (Name)" field="it_contact_external" value={config.it_contact_external || ''} />
          <div className="sm:col-span-2">
            <Field label="Externes IT-Unternehmen" field="external_it_company" value={config.external_it_company || ''} />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Scan Config */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><ScanLine className="h-4 w-4" /> Scan-Konfiguration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {SCAN_METHODS.map(m => (
              <label key={m.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={hasScan(m.value)} onCheckedChange={() => toggleArrayValue('scan_methods', m.value)} />
                <span className="text-sm font-body">{m.label}</span>
              </label>
            ))}
          </div>

          {/* SMB Details */}
          <Collapsible open={hasScan('smb')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">Ordner / SMB Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="SMB-Server" field="scan_smb_server" value={config.scan_smb_server || ''} />
                  <Field label="Scan-Benutzername" field="scan_smb_user" value={config.scan_smb_user || ''} />
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Switch checked={config.scan_smb_shared || false} onCheckedChange={v => update('scan_smb_shared', v)} />
                    <Label className="text-sm">Freigaben vorhanden</Label>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* SMTP Details */}
          <Collapsible open={hasScan('smtp')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">E-Mail / SMTP Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="SMTP-Server" field="scan_smtp_server" value={config.scan_smtp_server || ''} />
                  <Field label="Port" field="scan_smtp_port" value={config.scan_smtp_port || ''} />
                  <div className="flex items-center gap-3">
                    <Switch checked={config.scan_smtp_auth || false} onCheckedChange={v => update('scan_smtp_auth', v)} />
                    <Label className="text-sm">Authentifizierung erforderlich</Label>
                  </div>
                  <Field label="Absenderadresse" field="scan_smtp_sender" value={config.scan_smtp_sender || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* FTP Details */}
          <Collapsible open={hasScan('ftp')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">FTP Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="FTP-Server" field="scan_ftp_server" value={config.scan_ftp_server || ''} />
                  <Field label="Verzeichnis" field="scan_ftp_path" value={config.scan_ftp_path || ''} />
                  <Field label="FTP-Benutzer" field="scan_ftp_user" value={config.scan_ftp_user || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Card 3: Software */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><Package className="h-4 w-4" /> Software-Installation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {SOFTWARE_OPTIONS.map(s => (
              <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={activeSoftware.includes(s.value)} onCheckedChange={() => toggleSoftware(s.value)} />
                <span className="text-sm font-body">{s.label}</span>
              </label>
            ))}
          </div>

          {/* Fleet */}
          <Collapsible open={activeSoftware.includes('fleet')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">Fleet Management</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Fleet-Server URL" field="software_fleet_server" value={config.software_fleet_server || ''} />
                  <Field label="Proxy-Adresse" field="software_fleet_proxy" value={config.software_fleet_proxy || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Scan Software */}
          <Collapsible open={activeSoftware.includes('scan')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">Scansoftware</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Software-Name" field="software_scan_name" value={config.software_scan_name || ''} />
                  <Field label="Server" field="software_scan_server" value={config.software_scan_server || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Print Software */}
          <Collapsible open={activeSoftware.includes('print')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">Drucksoftware</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Software-Name (PaperCut, PrinterLogic...)" field="software_print_name" value={config.software_print_name || ''} />
                  <Field label="Server" field="software_print_server" value={config.software_print_server || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Follow Me */}
          <Collapsible open={activeSoftware.includes('followme')}>
            <CollapsibleContent className="pt-3 border-t border-border">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">Follow Me / Pull-Print</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-heading">System</Label>
                    <Select value={config.software_followme_system || ''} onValueChange={v => update('software_followme_system', v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="System wählen..." /></SelectTrigger>
                      <SelectContent>
                        {FOLLOWME_SYSTEMS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-heading">Kartenleser</Label>
                    <Select value={config.card_reader_type || ''} onValueChange={v => update('card_reader_type', v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Kartenleser wählen..." /></SelectTrigger>
                      <SelectContent>
                        {CARD_READERS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Server-Adresse" field="software_followme_server" value={config.software_followme_server || ''} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Card 4: Training */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Einweisung</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {TRAINING_OPTIONS.map(t => (
              <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={hasTraining(t.value)} onCheckedChange={() => toggleArrayValue('training_type', t.value)} />
                <span className="text-sm font-body">{t.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Card 5: Notes */}
      <Card>
        <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><StickyNote className="h-4 w-4" /> Notizen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="IT-Notizen" field="it_notes" value={config.it_notes || ''} type="textarea" />
          <Field label="Software-Anforderungen" field="software_notes" value={config.software_notes || ''} type="textarea" />
        </CardContent>
      </Card>
    </div>
  );
}
