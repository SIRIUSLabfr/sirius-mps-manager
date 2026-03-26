import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useLocationTree, useCreateLocation, useUpdateLocation, useDeleteLocation, LocationNode, LocationType } from '@/hooks/useLocationData';
import LocationTree from '@/components/standorte/LocationTree';
import LocationDialog from '@/components/standorte/LocationDialog';
import FloorPlanViewer from '@/components/standorte/FloorPlanViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function StandortePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveProjectId } = useActiveProject();
  const { tree, flat, isLoading } = useLocationTree(projectId || null);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const [selectedNode, setSelectedNode] = useState<LocationNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addType, setAddType] = useState<LocationType>('site');
  const [deleteNode, setDeleteNode] = useState<LocationNode | null>(null);

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocationMut = useDeleteLocation();

  const handleAdd = (parentId: string | null, type: LocationType) => {
    setEditingNode(null);
    setAddParentId(parentId);
    setAddType(type);
    setDialogOpen(true);
  };

  const handleEdit = (node: LocationNode) => {
    setEditingNode(node);
    setAddType(node.location_type as LocationType);
    setDialogOpen(true);
  };

  const handleSave = async (data: any) => {
    if (!projectId) return;
    try {
      if (editingNode) {
        await updateLocation.mutateAsync({ id: editingNode.id, ...data });
        toast.success('Gespeichert');
      } else {
        await createLocation.mutateAsync({ ...data, project_id: projectId });
        toast.success('Erstellt');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteNode || !projectId) return;
    try {
      await deleteLocationMut.mutateAsync({ id: deleteNode.id, projectId });
      if (selectedNode?.id === deleteNode.id) setSelectedNode(null);
      toast.success('Gelöscht');
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleteNode(null);
  };

  // Resolve selected node from flat list (in case tree refreshed)
  const resolvedSelected = selectedNode ? flat.find(n => n.id === selectedNode.id) || null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Standorte & Raumpläne</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Left: Location tree */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Standortstruktur
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Laden…</div>
            ) : (
              <LocationTree
                tree={tree}
                selectedId={resolvedSelected?.id || null}
                onSelect={setSelectedNode}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={setDeleteNode}
              />
            )}
          </CardContent>
        </Card>

        {/* Right: Detail / Floor plan */}
        <div>
          {resolvedSelected && projectId ? (
            <FloorPlanViewer location={resolvedSelected} projectId={projectId} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  Wähle einen Standort, ein Gebäude oder Stockwerk aus der Baumstruktur links, um Details und Raumpläne zu sehen.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  Rechtsklick auf einen Eintrag zum Bearbeiten, Löschen oder Hinzufügen von Unterelementen.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <LocationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editing={editingNode}
        parentId={addParentId}
        locationType={addType}
      />

      <AlertDialog open={!!deleteNode} onOpenChange={(o) => !o && setDeleteNode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteNode?.name}" und alle Unterelemente werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
