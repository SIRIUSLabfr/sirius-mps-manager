import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';
import { useDocuments } from '@/hooks/useAngebotData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AngebotConfigCard from '@/components/angebot/AngebotConfigCard';
import ZusatzvereinbarungenCard, { type Zusatzvereinbarungen, defaultZusatzvereinbarungen } from '@/components/angebot/ZusatzvereinbarungenCard';
import AuftragErteiltCard from '@/components/angebot/AuftragErteiltCard';
import DocumentsList from '@/components/angebot/DocumentsList';

export default function AngebotPage() {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const { activeProjectId, setActiveProjectId } = useActiveProject();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (urlProjectId) setActiveProjectId(urlProjectId);
  }, [urlProjectId, setActiveProjectId]);

  const projectId = urlProjectId || activeProjectId;
  const { data: project } = useProject(projectId || null);
  const isDaily = (project as any)?.project_type === 'daily';

  // Load active calculation
  const { data: calcData } = useQuery({
    queryKey: ['active-calc', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Zusatzvereinbarungen state - stored in calc config_json
  const [zusatz, setZusatz] = useState<Zusatzvereinbarungen>(defaultZusatzvereinbarungen);
  const [zusatzLoaded, setZusatzLoaded] = useState(false);

  useEffect(() => {
    if (calcData?.config_json && !zusatzLoaded) {
      const saved = (calcData.config_json as any)?.zusatzvereinbarungen;
      if (saved) {
        setZusatz({ ...defaultZusatzvereinbarungen, ...saved });
      }
      setZusatzLoaded(true);
    }
  }, [calcData, zusatzLoaded]);

  // Auto-save zusatz changes
  const handleZusatzChange = async (v: Zusatzvereinbarungen) => {
    setZusatz(v);
    if (calcData?.id) {
      const existingConfig = (calcData.config_json as any) || {};
      await supabase
        .from('calculations')
        .update({
          config_json: { ...existingConfig, zusatzvereinbarungen: v },
        })
        .eq('id', calcData.id);
    }
  };

  // Get signed document info
  const { data: docs = [] } = useDocuments(projectId || null);
  const signedDoc = docs.find(d => d.document_type === 'auftrag_unterschrieben');

  if (!projectId) {
    return <div className="p-6 text-muted-foreground">Kein Projekt ausgewählt.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">📋 Angebot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Angebot konfigurieren, PDF generieren und Auftrag bestätigen.
        </p>
      </div>

      {/* Bereich 1: Angebot konfigurieren */}
      <AngebotConfigCard
        projectId={projectId}
        projectName={project?.customer_name || 'Projekt'}
        calcData={calcData ? {
          finance_type: calcData.finance_type || 'leasing',
          term_months: calcData.term_months || 60,
          total_monthly_rate: calcData.total_monthly_rate || 0,
          total_hardware_ek: calcData.total_hardware_ek || 0,
          service_rate: calcData.service_rate || 0,
          config_json: calcData.config_json,
        } : null}
        zusatz={zusatz}
      />

      {/* Bereich 2: Zusatzvereinbarungen */}
      <ZusatzvereinbarungenCard
        value={zusatz}
        onChange={handleZusatzChange}
        defaultOpen={isDaily}
      />

      {/* Bereich 3: Auftrag erteilt */}
      <AuftragErteiltCard
        projectId={projectId}
        orderConfirmedAt={(project as any)?.order_confirmed_at || null}
        orderConfirmedBy={(project as any)?.order_confirmed_by || null}
        signedDocumentUrl={signedDoc?.file_url || null}
        signedDocZohoId={signedDoc?.zoho_attachment_id || null}
      />

      {/* Bereich 4: Dokumenten-Übersicht */}
      <DocumentsList projectId={projectId} />
    </div>
  );
}
