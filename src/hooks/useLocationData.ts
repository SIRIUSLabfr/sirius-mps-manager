import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export type LocationType = 'site' | 'building' | 'floor';

export interface LocationNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  location_type: string;
  name: string;
  short_name: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_country: string | null;
  building: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  children?: LocationNode[];
}

export interface FloorPlan {
  id: string;
  location_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  width: number | null;
  height: number | null;
  sort_order: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DevicePlacement {
  id: string;
  device_id: string;
  floor_plan_id: string;
  x_percent: number;
  y_percent: number;
  label: string | null;
  created_at: string;
  updated_at: string;
}

function buildTree(locations: LocationNode[]): LocationNode[] {
  const map = new Map<string, LocationNode>();
  const roots: LocationNode[] = [];

  locations.forEach(loc => {
    map.set(loc.id, { ...loc, children: [] });
  });

  map.forEach(loc => {
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children!.push(loc);
    } else if (!loc.parent_id) {
      roots.push(loc);
    }
  });

  return roots;
}

export function useLocationTree(projectId: string | null) {
  const query = useQuery({
    queryKey: ['locations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return data as LocationNode[];
    },
    enabled: !!projectId,
  });

  const tree = query.data ? buildTree(query.data) : [];
  const flat = query.data || [];

  return { ...query, tree, flat };
}

export function useFloorPlans(locationId: string | null) {
  return useQuery({
    queryKey: ['floor_plans', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('location_id', locationId)
        .order('sort_order');
      if (error) throw error;
      return data as FloorPlan[];
    },
    enabled: !!locationId,
  });
}

export function useDevicePlacements(floorPlanId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['device_placements', floorPlanId],
    queryFn: async () => {
      if (!floorPlanId) return [];
      const { data, error } = await supabase
        .from('device_placements')
        .select('*')
        .eq('floor_plan_id', floorPlanId);
      if (error) throw error;
      return data as DevicePlacement[];
    },
    enabled: !!floorPlanId,
  });

  useEffect(() => {
    if (!floorPlanId) return;
    const ch = supabase
      .channel(`placements-${floorPlanId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'device_placements',
        filter: `floor_plan_id=eq.${floorPlanId}`,
      }, () => qc.invalidateQueries({ queryKey: ['device_placements', floorPlanId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [floorPlanId, qc]);

  return query;
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loc: {
      project_id: string;
      name: string;
      parent_id?: string | null;
      location_type: LocationType;
      address_street?: string;
      address_zip?: string;
      address_city?: string;
      short_name?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.from('locations').insert(loc as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['locations', vars.project_id] });
    },
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase.from('locations').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['locations', data.project_id] });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['locations', vars.projectId] });
    },
  });
}

export function useUploadFloorPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, locationId, projectId }: { file: File; locationId: string; projectId: string }) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${projectId}/${locationId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('floor-plans').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('floor-plans').getPublicUrl(path);

      const { data, error } = await supabase.from('floor_plans').insert({
        location_id: locationId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: ext,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['floor_plans', data.location_id] });
    },
  });
}

export function useDeleteFloorPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, locationId, fileUrl }: { id: string; locationId: string; fileUrl: string }) => {
      // Try to extract path from URL for storage deletion
      try {
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/storage/v1/object/public/floor-plans/');
        if (pathParts[1]) {
          await supabase.storage.from('floor-plans').remove([pathParts[1]]);
        }
      } catch {}
      const { error } = await supabase.from('floor_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['floor_plans', vars.locationId] });
    },
  });
}

export function useUpsertPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { device_id: string; floor_plan_id: string; x_percent: number; y_percent: number; label?: string }) => {
      const { data, error } = await supabase
        .from('device_placements')
        .upsert(p as any, { onConflict: 'device_id,floor_plan_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['device_placements', data.floor_plan_id] });
    },
  });
}

export function useDeletePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, floorPlanId }: { id: string; floorPlanId: string }) => {
      const { error } = await supabase.from('device_placements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['device_placements', vars.floorPlanId] });
    },
  });
}
