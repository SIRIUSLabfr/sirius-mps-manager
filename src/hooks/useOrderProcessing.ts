import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOrderProcessing(projectId: string | null) {
  return useQuery({
    queryKey: ['order_processing', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('order_processing' as any)
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId,
  });
}

export function useAllOrderProcessing() {
  return useQuery({
    queryKey: ['order_processing_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_processing' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useUpsertOrderProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: any) => {
      const { data, error } = await supabase
        .from('order_processing' as any)
        .upsert(record as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['order_processing', variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ['order_processing_all'] });
    },
  });
}

export function useUpdateOrderProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('order_processing' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['order_processing', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['order_processing_all'] });
    },
  });
}
