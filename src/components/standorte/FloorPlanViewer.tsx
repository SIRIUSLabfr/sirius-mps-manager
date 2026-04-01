import { useRef, useState, useCallback } from 'react';
import { Upload, Trash2, Image as ImageIcon, Printer, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationNode, FloorPlan, DevicePlacement, useUploadFloorPlan, useDeleteFloorPlan, useFloorPlans, useDevicePlacements, useUpsertPlacement, useDeletePlacement } from '@/hooks/useLocationData';
import { useProjectDevices } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FloorPlanViewerProps {
  location: LocationNode;
  projectId: string;
}

export default function FloorPlanViewer({ location, projectId }: FloorPlanViewerProps) {
  const { data: floorPlans } = useFloorPlans(location.id);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const activePlan = floorPlans?.find(fp => fp.id === activePlanId) || floorPlans?.[0] || null;
  const { data: placements } = useDevicePlacements(activePlan?.id || null);
  const { data: devices } = useProjectDevices(projectId);
  const uploadMutation = useUploadFloorPlan();
  const deletePlanMutation = useDeleteFloorPlan();
  const upsertPlacement = useUpsertPlacement();
  const deletePlacement = useDeletePlacement();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const [draggingDeviceId, setDraggingDeviceId] = useState<string | null>(null);
  const [movingPlacement, setMovingPlacement] = useState<DevicePlacement | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'pdf'].includes(ext || '')) {
      toast.error('Nur PNG, JPG oder PDF erlaubt');
      return;
    }
    try {
      await uploadMutation.mutateAsync({ file, locationId: location.id, projectId });
      toast.success('Raumplan hochgeladen');
    } catch (err: any) {
      toast.error(err.message || 'Upload fehlgeschlagen');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    try {
      await deletePlanMutation.mutateAsync({ id: activePlan.id, locationId: location.id, fileUrl: activePlan.file_url });
      toast.success('Raumplan gelöscht');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!activePlan || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(0, Math.min(100, x)) * 100) / 100;
    const clampedY = Math.round(Math.max(0, Math.min(100, y)) * 100) / 100;

    if (movingPlacement) {
      // Moving an existing placement
      upsertPlacement.mutate({
        device_id: movingPlacement.device_id,
        floor_plan_id: activePlan.id,
        x_percent: clampedX,
        y_percent: clampedY,
      });
      setMovingPlacement(null);
      return;
    }

    if (draggingDeviceId) {
      // Placing a new device
      upsertPlacement.mutate({
        device_id: draggingDeviceId,
        floor_plan_id: activePlan.id,
        x_percent: clampedX,
        y_percent: clampedY,
      });
      setDraggingDeviceId(null);
    }
  }, [activePlan, draggingDeviceId, movingPlacement, upsertPlacement]);

  // Unplaced devices for this project
  const placedDeviceIds = new Set(placements?.map(p => p.device_id) || []);
  const unplacedDevices = devices?.filter(d => !placedDeviceIds.has(d.id) && (d.ist_model || d.soll_model)) || [];

  const locationLabel = (() => {
    const parts: string[] = [];
    if (location.location_type === 'site') {
      if (location.address_street) parts.push(location.address_street);
      if (location.address_zip || location.address_city) parts.push([location.address_zip, location.address_city].filter(Boolean).join(' '));
    }
    return parts.join(', ');
  })();

  const typeLabel = location.location_type === 'site' ? 'Standort' : location.location_type === 'building' ? 'Gebäude' : 'Stockwerk';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">{typeLabel}</span>
        </div>
        <h2 className="text-lg font-heading font-bold text-foreground">{location.name}</h2>
        {locationLabel && <p className="text-sm text-muted-foreground">{locationLabel}</p>}
        {location.notes && <p className="text-xs text-muted-foreground mt-1">{location.notes}</p>}
      </div>

      {/* Floor plans section – only for floors */}
      {location.location_type === 'floor' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Raumpläne
              </CardTitle>
              <div className="flex items-center gap-2">
                {floorPlans && floorPlans.length > 1 && (
                  <Select value={activePlan?.id || ''} onValueChange={setActivePlanId}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {floorPlans.map(fp => (
                        <SelectItem key={fp.id} value={fp.id}>{fp.file_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={handleUpload} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Hochladen
                </Button>
                {activePlan && (
                  <Button size="sm" variant="ghost" onClick={handleDeletePlan} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!activePlan ? (
              <div
                className="h-64 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Raumplan hochladen (PNG, JPG, PDF)</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Plan image with placements */}
                <div
                  ref={imgRef}
                  className={cn(
                    'relative rounded-lg overflow-hidden border border-border bg-muted/30',
                    (draggingDeviceId || movingPlacement) && 'cursor-crosshair ring-2 ring-primary/30',
                  )}
                  onClick={handleImageClick}
                >
                  <img
                    src={activePlan.file_url}
                    alt={activePlan.file_name}
                    className="w-full h-auto max-h-[500px] object-contain"
                    draggable={false}
                  />
                  {/* Device pins */}
                  {placements?.map(p => {
                    const dev = devices?.find(d => d.id === p.device_id);
                    const label = p.label || dev?.soll_model || dev?.ist_model || 'Gerät';
                    const isBeingMoved = movingPlacement?.id === p.id;
                    return (
                      <Tooltip key={p.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute -ml-3 -mt-3 z-10 group",
                              isBeingMoved && "opacity-40"
                            )}
                            style={{ left: `${p.x_percent}%`, top: `${p.y_percent}%` }}
                          >
                            <div className="relative">
                              <button
                                className={cn(
                                  "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold shadow-lg border-2 border-primary-foreground/50 hover:scale-110 transition-transform",
                                  isBeingMoved && "ring-2 ring-accent"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Platzierung entfernen?')) {
                                    deletePlacement.mutate({ id: p.id, floorPlanId: activePlan.id });
                                  }
                                }}
                              >
                                <Printer className="h-3 w-3" />
                              </button>
                              {/* Move handle */}
                              <button
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                title="Verschieben"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingPlacement(isBeingMoved ? null : p);
                                  setDraggingDeviceId(null);
                                }}
                              >
                                <Move className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-semibold">{label}</p>
                          {dev && <p className="text-muted-foreground">{dev.ist_building} {dev.ist_floor} {dev.ist_room}</p>}
                          <p className="text-muted-foreground mt-0.5">Hover → <Move className="inline h-2.5 w-2.5" /> zum Verschieben</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Unplaced devices */}
                {movingPlacement && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-accent/20 border border-accent/40">
                    <Move className="h-3.5 w-3.5 text-accent-foreground" />
                    <p className="text-xs text-accent-foreground font-medium">
                      Gerät wird verschoben – klicke auf die neue Position im Plan
                    </p>
                    <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={() => setMovingPlacement(null)}>
                      Abbrechen
                    </Button>
                  </div>
                )}
                {unplacedDevices.length > 0 && (
                  <div>
                    <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground mb-2">
                      Geräte platzieren – wähle ein Gerät, dann klicke auf den Plan
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unplacedDevices.slice(0, 20).map(d => (
                        <button
                          key={d.id}
                          onClick={() => setDraggingDeviceId(d.id === draggingDeviceId ? null : d.id)}
                          className={cn(
                            'text-xs px-2 py-1 rounded-md border transition-colors',
                            d.id === draggingDeviceId
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border hover:border-primary/40 text-foreground',
                          )}
                        >
                          {d.soll_model || d.ist_model || 'Gerät'} {d.ist_room ? `(${d.ist_room})` : ''}
                        </button>
                      ))}
                      {unplacedDevices.length > 20 && (
                        <span className="text-xs text-muted-foreground self-center">+{unplacedDevices.length - 20} weitere</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info for non-floor nodes */}
      {location.location_type !== 'floor' && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {location.location_type === 'site'
                ? 'Wähle ein Gebäude oder Stockwerk, um Raumpläne zu sehen. Rechtsklick zum Hinzufügen.'
                : 'Wähle ein Stockwerk, um den Raumplan zu sehen und Geräte zu platzieren.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
