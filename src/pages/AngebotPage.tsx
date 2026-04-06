import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';
import { useDocuments } from '@/hooks/useAngebotData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zohoClient } from '@/lib/zohoClient';
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

  // Load SIRIUS deal owner as Ansprechpartner from Zoho
  const dealId = (project as any)?.zoho_deal_id;
  const { data: dealOwner } = useQuery({
    queryKey: ['zoho-deal-owner', dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const result = await zohoClient.getDeal(dealId);
      const deal = result?.data?.[0];
      if (!deal?.Owner) return null;
      const owner = deal.Owner;
      return {
        name: owner.name || '',
        email: owner.email || '',
        phone: owner.phone || owner.mobile || '',
        role: 'Ihr Ansprechpartner',
        zoho_user_id: owner.id || '',
      };
    },
    enabled: !!dealId,
    staleTime: 1000 * 60 * 10, // cache 10 min
  });

  // Zusatzvereinbarungen state – persisted in projects.quote_config
  const [zusatz, setZusatz] = useState<Zusatzvereinbarungen>(defaultZusatzvereinbarungen);
  const [zusatzLoaded, setZusatzLoaded] = useState(false);

  useEffect(() => {
    if (!project || zusatzLoaded) return;
    const saved = (project as any)?.quote_config?.zusatzvereinbarungen;
    if (saved) {
      if (saved.items && Array.isArray(saved.items)) {
        setZusatz({ ...defaultZusatzvereinbarungen, ...saved });
      } else {
        setZusatz({
          ...defaultZusatzvereinbarungen,
          mietfreie_startphase: saved.mietfreie_startphase || 'keine',
          berechnungsintervall: saved.berechnungsintervall || 'quartalsweise',
        });
      }
    }
    // Also try legacy location in calcData
    if (!saved && calcData?.config_json) {
      const legacy = (calcData.config_json as any)?.zusatzvereinbarungen;
      if (legacy?.items && Array.isArray(legacy.items)) {
        setZusatz({ ...defaultZusatzvereinbarungen, ...legacy });
      }
    }
    setZusatzLoaded(true);
  }, [project, calcData, zusatzLoaded]);

  const handleZusatzChange = async (v: Zusatzvereinbarungen) => {
    setZusatz(v);
    if (projectId) {
      const existingConfig = ((project as any)?.quote_config as any) || {};
      await supabase
        .from('projects')
        .update({
          quote_config: { ...existingConfig, zusatzvereinbarungen: v },
        } as any)
        .eq('id', projectId);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  };

  // Build Ansprechpartner: prefer Zoho deal owner, fallback to customer contact
  const ansprechpartner = dealOwner
    ? {
        name: dealOwner.name,
        role: dealOwner.role,
        email: dealOwner.email,
        phone: dealOwner.phone,
        photoUrl: dealOwner.zoho_user_id
          ? `/.netlify/functions/zoho-photo?userId=${dealOwner.zoho_user_id}`
          : undefined,
      }
    : null;

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

      {/* Ansprechpartner card */}
      {ansprechpartner && (
        <div className="flex items-center gap-4 bg-muted/30 border rounded-lg p-4">
          {(ansprechpartner as any).photoUrl ? (
            <img
              src={(ansprechpartner as any).photoUrl}
              alt={ansprechpartner.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {ansprechpartner.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Ihr Ansprechpartner bei SIRIUS</p>
            <p className="font-semibold text-sm">{ansprechpartner.name}</p>
            {ansprechpartner.email && (
              <p className="text-xs text-muted-foreground">{ansprechpartner.email} {ansprechpartner.phone ? `· ${ansprechpartner.phone}` : ''}</p>
            )}
          </div>
        </div>
      )}

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
        customerName={project?.customer_name}
        contactPerson={ansprechpartner?.name}
        customerAddress={(project as any)?.warehouse_address}
        customerNumber={project?.customer_number || undefined}
        angebotNumber={project?.project_number || undefined}
        ansprechpartner={ansprechpartner}
      />

      <ZusatzvereinbarungenCard
        value={zusatz}
        onChange={handleZusatzChange}
        defaultOpen={isDaily}
      />

      <AuftragErteiltCard
        projectId={projectId}
        orderConfirmedAt={(project as any)?.order_confirmed_at || null}
        orderConfirmedBy={(project as any)?.order_confirmed_by || null}
        signedDocumentUrl={signedDoc?.file_url || null}
        signedDocZohoId={signedDoc?.zoho_attachment_id || null}
      />

      <DocumentsList projectId={projectId} />
    </div>
  );
}
