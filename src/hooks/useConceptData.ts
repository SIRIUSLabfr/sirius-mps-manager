import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConceptConfig {
  overrides: {
    customer_name?: string;
    project_number?: string;
    date?: string;
    contact_customer?: string;
    contact_sirius?: string;
  };
  blocks: {
    ist_analyse: boolean;
    soll_konzept: boolean;
    ist_soll_vergleich: boolean;
    standortuebersicht: boolean;
    finanzierung: boolean;
    rollout_zeitplan: boolean;
    it_konzept: boolean;
    service_level: boolean;
    ansprechpartner: boolean;
  };
  texts: {
    einleitung: string;
    abschluss: string;
    anmerkungen: string;
  };
}

export const defaultConceptConfig: ConceptConfig = {
  overrides: {},
  blocks: {
    ist_analyse: true,
    soll_konzept: true,
    ist_soll_vergleich: true,
    standortuebersicht: true,
    finanzierung: true,
    rollout_zeitplan: false,
    it_konzept: false,
    service_level: false,
    ansprechpartner: true,
  },
  texts: {
    einleitung: '',
    abschluss: '',
    anmerkungen: '',
  },
};

export function useConcept(projectId: string | null) {
  return useQuery({
    queryKey: ['concept', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('concepts')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useSaveConcept(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: ConceptConfig) => {
      if (!projectId) throw new Error('No project');
      const { data: existing } = await supabase
        .from('concepts')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('concepts')
          .update({ config_json: config as any })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('concepts')
          .insert({ project_id: projectId, config_json: config as any });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['concept', projectId] }),
  });
}
