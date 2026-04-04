import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject, useProjectDevices, useUsers } from '@/hooks/useProjectData';
import { useLocations } from '@/hooks/useRolloutData';
import { useConcept, useSaveConcept, defaultConceptConfig, type ConceptConfig } from '@/hooks/useConceptData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInputString } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Save, Eye, Loader2, Plus, ArrowRight } from 'lucide-react';
import KonzeptPreview from '@/components/konzept/KonzeptPreview';
import WorkflowIndicator from '@/components/konzept/WorkflowIndicator';
import ConceptVersionList from '@/components/konzept/ConceptVersionList';
import ZohoConceptActions from '@/components/konzept/ZohoConceptActions';
import { formatDate } from '@/lib/constants';

const BLOCK_LABELS: Record<string, string> = {
  ist_analyse: 'Ausgangssituation / IST-Analyse',
  soll_konzept: 'SOLL-Konzept / Neue Geräteflotte',
  ist_soll_vergleich: 'IST-SOLL Vergleich',
  standortuebersicht: 'Standortübersicht',
  finanzierung: 'Finanzierung & Kosten',
  rollout_zeitplan: 'Rollout-Zeitplan',
  it_konzept: 'IT-Konzept',
  service_level: 'Service-Level',
  ansprechpartner: 'Ansprechpartner & Kontakt',
};

export default function KonzeptPage() {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const { activeProjectId, setActiveProjectId } = useActiveProject();

  useEffect(() => {
    if (urlProjectId) setActiveProjectId(urlProjectId);
  }, [urlProjectId, setActiveProjectId]);
  const { data: project } = useProject(activeProjectId);
  const { data: devices = [] } = useProjectDevices(activeProjectId);
  const { data: locations = [] } = useLocations(activeProjectId);
  const { data: users = [] } = useUsers();
  const queryClient = useQueryClient();

  // Load all concept versions
  const { data: allConcepts = [], isLoading } = useQuery({
    queryKey: ['concepts_all', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data, error } = await supabase
        .from('concepts')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  // Load all calculations (scenarios)
  const { data: allCalculations = [] } = useQuery({
    queryKey: ['calculations_all', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data } = await supabase.from('calculations').select('*').eq('project_id', activeProjectId).order('created_at');
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const calculation = selectedCalcId
    ? allCalculations.find(c => c.id === selectedCalcId) || allCalculations.find((c: any) => c.is_active) || allCalculations[0] || null
    : allCalculations.find((c: any) => c.is_active) || allCalculations[0] || null;

  const { data: itConfig } = useQuery({
    queryKey: ['it_config', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const { data } = await supabase.from('it_config').select('*').eq('project_id', activeProjectId).maybeSingle();
      return data;
    },
    enabled: !!activeProjectId,
  });

  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConceptConfig>(defaultConceptConfig);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rolloutDialogOpen, setRolloutDialogOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Select latest concept when loaded
  useEffect(() => {
    if (allConcepts.length > 0 && !activeConceptId) {
      setActiveConceptId(allConcepts[0].id);
    }
  }, [allConcepts, activeConceptId]);

  // Load config from active concept
  useEffect(() => {
    const active = allConcepts.find(c => c.id === activeConceptId);
    if (active?.config_json) {
      const saved = active.config_json as unknown as ConceptConfig;
      setConfig({
        ...defaultConceptConfig,
        ...saved,
        blocks: { ...defaultConceptConfig.blocks, ...saved.blocks },
        texts: { ...defaultConceptConfig.texts, ...saved.texts },
        overrides: { ...defaultConceptConfig.overrides, ...saved.overrides },
      });
    } else if (allConcepts.length === 0) {
      // Pre-fill from project
      if (project) {
        const lead = users.find(u => u.id === project.project_lead);
        const contacts = project.customer_contacts as any[];
        const firstContact = contacts?.[0];
        setConfig(prev => ({
          ...prev,
          overrides: {
            customer_name: project.customer_name,
            project_number: project.project_number || '',
            contact_sirius: lead?.full_name || '',
            contact_customer: firstContact ? `${firstContact.name || ''} ${firstContact.email ? `(${firstContact.email})` : ''}`.trim() : '',
            date: new Date().toISOString().slice(0, 10),
          },
        }));
      }
    }
  }, [activeConceptId, allConcepts, project, users]);

  const handleSave = async () => {
    if (!activeProjectId) return;
    setSaving(true);
    try {
      if (activeConceptId) {
        const { error } = await supabase
          .from('concepts')
          .update({ config_json: config as any })
          .eq('id', activeConceptId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('concepts')
          .insert({ project_id: activeProjectId, config_json: config as any })
          .select()
          .single();
        if (error) throw error;
        setActiveConceptId(data.id);
      }
      queryClient.invalidateQueries({ queryKey: ['concepts_all', activeProjectId] });
      toast.success('Konzept gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleNewVersion = async () => {
    if (!activeProjectId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('concepts')
        .insert({
          project_id: activeProjectId,
          config_json: config as any,
          title: `MPS Konzept v${allConcepts.length + 1}`,
        })
        .select()
        .single();
      if (error) throw error;
      setActiveConceptId(data.id);
      queryClient.invalidateQueries({ queryKey: ['concepts_all', activeProjectId] });
      toast.success('Neue Version erstellt');
    } catch {
      toast.error('Fehler beim Erstellen');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferToRollout = async () => {
    if (!activeProjectId || !calculation?.config_json) return;
    setTransferring(true);
    try {
      const calcConfig = calculation.config_json as any;
      const groups = calcConfig?.device_groups || [];
      const inserts: any[] = [];
      for (const group of groups) {
        const qty = group.quantity || 1;
        for (let i = 0; i < qty; i++) {
          inserts.push({
            project_id: activeProjectId,
            soll_manufacturer: group.manufacturer || null,
            soll_model: group.model || null,
            soll_building: group.location || null,
            zoho_product_id: group.zoho_product_id || null,
            preparation_status: 'pending',
          });
        }
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('devices').insert(inserts);
        if (error) throw error;
      }
      toast.success(`${inserts.length} SOLL-Geräte in die Rolloutliste übernommen`);
      setRolloutDialogOpen(false);
      navigate(`/projekt/${activeProjectId}/rollout`);
    } catch {
      toast.error('Fehler beim Übernehmen');
    } finally {
      setTransferring(false);
    }
  };

  // Workflow status
  const hasCalc = !!calculation;
  const hasConcept = allConcepts.length > 0;
  const sollDevices = devices.filter(d => d.soll_model);
  const hasRolloutData = sollDevices.length > 0;
  const workflowSteps = [
    { label: 'Kalkulation', status: hasCalc ? 'done' as const : 'pending' as const },
    { label: 'Konzept', status: hasConcept ? 'done' as const : 'active' as const },
    { label: 'Rollout-Planung', status: hasRolloutData ? 'done' as const : 'pending' as const },
  ];

  const updateOverride = (key: string, val: string) =>
    setConfig(p => ({ ...p, overrides: { ...p.overrides, [key]: val } }));
  const toggleBlock = (key: string) =>
    setConfig(p => ({ ...p, blocks: { ...p.blocks, [key]: !p.blocks[key as keyof typeof p.blocks] } }));
  const updateText = (key: string, val: string) =>
    setConfig(p => ({ ...p, texts: { ...p.texts, [key]: val } }));

  if (!activeProjectId || !project) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Wähle zuerst ein Projekt aus der Projektübersicht.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Workflow indicator */}
      <WorkflowIndicator steps={workflowSteps} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Konzept</h1>
        <div className="flex gap-2 flex-wrap">
          <ZohoConceptActions />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewOpen(!previewOpen)}>
            <Eye className="h-4 w-4" /> {previewOpen ? 'Ausblenden' : 'Vorschau'}
          </Button>
          {allConcepts.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleNewVersion} disabled={saving}>
              <Plus className="h-4 w-4" /> Neue Version
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </div>

      {/* Version list */}
      <ConceptVersionList
        versions={allConcepts}
        activeId={activeConceptId}
        onSelect={setActiveConceptId}
      />

      {/* Config section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grunddaten */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-sm">Grunddaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Kundenname</Label>
              <Input value={config.overrides.customer_name || ''} onChange={e => updateOverride('customer_name', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Projektnummer</Label>
              <Input value={config.overrides.project_number || ''} onChange={e => updateOverride('project_number', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Datum</Label>
              <DateInputString value={config.overrides.date || null} onChange={v => updateOverride('date', v || '')} size="sm" />
            </div>
            <div>
              <Label className="text-xs">Ansprechpartner Kunde</Label>
              <Input value={config.overrides.contact_customer || ''} onChange={e => updateOverride('contact_customer', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Ansprechpartner SIRIUS</Label>
              <Input value={config.overrides.contact_sirius || ''} onChange={e => updateOverride('contact_sirius', e.target.value)} className="h-8 text-sm" />
            </div>
            {allCalculations.length > 1 && (
              <div>
                <Label className="text-xs">Kalkulationsszenario</Label>
                <Select value={calculation?.id || ''} onValueChange={setSelectedCalcId}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Szenario wählen" /></SelectTrigger>
                  <SelectContent>
                    {allCalculations.map((c: any, i: number) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label || `Szenario ${i + 1}`}{c.is_active ? ' (aktiv)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inhaltsbausteine */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-sm">Inhaltsbausteine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Object.entries(BLOCK_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`block-${key}`}
                  checked={config.blocks[key as keyof typeof config.blocks]}
                  onCheckedChange={() => toggleBlock(key)}
                />
                <label htmlFor={`block-${key}`} className="text-sm cursor-pointer">{label}</label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Texte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-sm">Zusätzliche Texte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Einleitung / Anschreiben</Label>
              <Textarea
                value={config.texts.einleitung}
                onChange={e => updateText('einleitung', e.target.value)}
                placeholder="Sehr geehrte Damen und Herren, im Folgenden präsentieren wir Ihnen unser Konzept für..."
                className="text-sm min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">Abschluss-Text</Label>
              <Textarea
                value={config.texts.abschluss}
                onChange={e => updateText('abschluss', e.target.value)}
                placeholder="Wir freuen uns auf die Zusammenarbeit..."
                className="text-sm min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Individuelle Anmerkungen</Label>
              <Textarea
                value={config.texts.anmerkungen}
                onChange={e => updateText('anmerkungen', e.target.value)}
                placeholder="Freie Notizen..."
                className="text-sm min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation to Rollout */}
      {hasConcept && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (hasCalc && !hasRolloutData) {
                setRolloutDialogOpen(true);
              } else {
                navigate(`/projekt/${activeProjectId}/rollout`);
              }
            }}
          >
            Weiter zur Rollout-Planung <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Preview */}
      {previewOpen && (
        <KonzeptPreview
          config={config}
          project={project}
          devices={devices}
          locations={locations}
          calculation={calculation}
          itConfig={itConfig}
        />
      )}

      {/* Transfer dialog */}
      <Dialog open={rolloutDialogOpen} onOpenChange={setRolloutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">SOLL-Geräte übernehmen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchtest du die SOLL-Geräte aus der Kalkulation in die Rolloutliste übernehmen?
            Es werden Geräte-Einträge basierend auf den Gerätegruppen der Kalkulation erstellt.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setRolloutDialogOpen(false);
              navigate(`/projekt/${activeProjectId}/rollout`);
            }}>
              Ohne Übernahme fortfahren
            </Button>
            <Button size="sm" className="gap-2" onClick={handleTransferToRollout} disabled={transferring}>
              {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Geräte übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
