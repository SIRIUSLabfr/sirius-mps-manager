import { useState, useEffect, useMemo } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject, useProjectDevices, useUsers } from '@/hooks/useProjectData';
import { useLocations } from '@/hooks/useRolloutData';
import { useConcept, useSaveConcept, defaultConceptConfig, type ConceptConfig } from '@/hooks/useConceptData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Save, ChevronDown, Eye, Loader2 } from 'lucide-react';
import KonzeptPreview from '@/components/konzept/KonzeptPreview';
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
  const { activeProjectId } = useActiveProject();
  const { data: project } = useProject(activeProjectId);
  const { data: devices = [] } = useProjectDevices(activeProjectId);
  const { data: locations = [] } = useLocations(activeProjectId);
  const { data: users = [] } = useUsers();
  const { data: conceptRow, isLoading } = useConcept(activeProjectId);
  const saveMutation = useSaveConcept(activeProjectId);

  const { data: calculation } = useQuery({
    queryKey: ['calculation', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const { data } = await supabase.from('calculations').select('*').eq('project_id', activeProjectId).maybeSingle();
      return data;
    },
    enabled: !!activeProjectId,
  });

  const { data: itConfig } = useQuery({
    queryKey: ['it_config', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const { data } = await supabase.from('it_config').select('*').eq('project_id', activeProjectId).maybeSingle();
      return data;
    },
    enabled: !!activeProjectId,
  });

  const [config, setConfig] = useState<ConceptConfig>(defaultConceptConfig);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (conceptRow?.config_json) {
      const saved = conceptRow.config_json as unknown as ConceptConfig;
      setConfig({ ...defaultConceptConfig, ...saved, blocks: { ...defaultConceptConfig.blocks, ...saved.blocks }, texts: { ...defaultConceptConfig.texts, ...saved.texts }, overrides: { ...defaultConceptConfig.overrides, ...saved.overrides } });
    }
  }, [conceptRow]);

  // Pre-fill overrides from project data
  useEffect(() => {
    if (project && !conceptRow) {
      const lead = users.find(u => u.id === project.project_lead);
      const contacts = project.customer_contacts as any[];
      const firstContact = contacts?.[0];
      setConfig(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          customer_name: prev.overrides.customer_name || project.customer_name,
          project_number: prev.overrides.project_number || project.project_number || '',
          contact_sirius: prev.overrides.contact_sirius || lead?.full_name || '',
          contact_customer: prev.overrides.contact_customer || (firstContact ? `${firstContact.name || ''} ${firstContact.email ? `(${firstContact.email})` : ''}`.trim() : ''),
          date: prev.overrides.date || new Date().toISOString().slice(0, 10),
        },
      }));
    }
  }, [project, users, conceptRow]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(config);
      toast.success('Konzept gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    }
  };

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Konzept / Angebot</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewOpen(!previewOpen)}>
            <Eye className="h-4 w-4" /> {previewOpen ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </div>

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
              <Input type="date" value={config.overrides.date || ''} onChange={e => updateOverride('date', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Ansprechpartner Kunde</Label>
              <Input value={config.overrides.contact_customer || ''} onChange={e => updateOverride('contact_customer', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Ansprechpartner SIRIUS</Label>
              <Input value={config.overrides.contact_sirius || ''} onChange={e => updateOverride('contact_sirius', e.target.value)} className="h-8 text-sm" />
            </div>
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
    </div>
  );
}
