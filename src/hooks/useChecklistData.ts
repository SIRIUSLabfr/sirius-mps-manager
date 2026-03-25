import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useChecklists(projectId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['checklists', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`checklists-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checklists',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  return query;
}
