import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject, useProjectDevices } from '@/hooks/useProjectData';
import { useLocations } from '@/hooks/useRolloutData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, FileText, Upload } from 'lucide-react';
import { formatDate } from '@/lib/constants';

export default function KonzeptPage() {
  const { activeProjectId } = useActiveProject();
  const { data: project } = useProject(activeProjectId);
  const { data: devices } = useProjectDevices(activeProjectId);
  const { data: locations } = useLocations(activeProjectId);

  if (!activeProjectId || !project) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Wähle zuerst ein Projekt aus der Projektübersicht.</p>
      </div>
    );
  }

  const totalDevices = devices?.length || 0;
  const sollDevices = devices?.filter(d => d.soll_model).length || 0;
  const locationCount = locations?.length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Konzept / Angebot</h1>

      <Alert className="border-secondary/30 bg-secondary/5">
        <Info className="h-4 w-4 text-secondary" />
        <AlertDescription className="text-sm">
          Das Konzept/Angebots-Modul wird in Phase 2 umgesetzt.
        </AlertDescription>
      </Alert>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button disabled className="gap-2 font-heading opacity-50">
            <Upload className="h-4 w-4" /> Projektdaten an Zoho CRM übergeben
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Kommt in Phase 2</p></TooltipContent>
      </Tooltip>

      <Card>
        <CardHeader><CardTitle className="font-heading text-base">Projekt-Zusammenfassung</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Kunde</p>
              <p className="font-medium">{project.customer_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Projektnummer</p>
              <p className="font-medium">{project.project_number || '–'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Geräte gesamt</p>
              <p className="font-medium">{totalDevices}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Davon SOLL</p>
              <p className="font-medium">{sollDevices}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Standorte</p>
              <p className="font-medium">{locationCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Zeitraum</p>
              <p className="font-medium">{formatDate(project.rollout_start)} – {formatDate(project.rollout_end)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-heading uppercase tracking-wide mb-1">Status</p>
              <p className="font-medium capitalize">{project.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
