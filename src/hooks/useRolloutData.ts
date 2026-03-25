import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useLocations(projectId: string | null) {
  return useQuery({
    queryKey: ['locations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useDevicesRealtime(projectId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['devices', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('project_id', projectId)
        .order('device_number');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`devices-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  return query;
}
