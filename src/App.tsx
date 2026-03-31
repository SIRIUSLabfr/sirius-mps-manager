import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZohoProvider, useZoho } from "@/hooks/useZoho";
import { ActiveProjectProvider, useActiveProject } from "@/hooks/useActiveProject";
import DashboardLayout from "@/components/layout/DashboardLayout";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import ProjectListPage from "./pages/ProjectListPage";
import TagesgeschaeftListPage from "./pages/TagesgeschaeftListPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import DailyDashboardPage from "./pages/DailyDashboardPage";
import DailyGeraeteListePage from "./pages/DailyGeraeteListePage";
import ProjectDataPage from "./pages/ProjectDataPage";
import RolloutListPage from "./pages/RolloutListPage";
import IstSollPage from "./pages/IstSollPage";
import SopPage from "./pages/SopPage";
import ItEdvPage from "./pages/ItEdvPage";
import LogistikPage from "./pages/LogistikPage";
import ChecklistenPage from "./pages/ChecklistenPage";
import KalenderPage from "./pages/KalenderPage";
import KalkulationPage from "./pages/KalkulationPage";
import KonzeptPage from "./pages/KonzeptPage";
import TeamPage from "./pages/TeamPage";
import StandortePage from "./pages/StandortePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RootRedirect() {
  const { dealId } = useZoho();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zohoPreFill, setZohoPreFill] = useState<{ deal_id?: string }>({});
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (resolved) return;
    if (!dealId) {
      setResolved(true);
      return;
    }

    const lookup = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('zoho_deal_id', dealId)
        .maybeSingle();

      if (data) {
        setActiveProjectId(data.id);
        navigate(`/projekt/${data.id}`, { replace: true });
      } else {
        setZohoPreFill({ deal_id: dealId });
        setDialogOpen(true);
      }
      setResolved(true);
    };

    lookup();
  }, [dealId, resolved, navigate, setActiveProjectId]);

  if (!resolved && dealId) {
    return null; // wait for lookup
  }

  if (!dealId && resolved) {
    return <Navigate to="/projekte" replace />;
  }

  return (
    <NewProjectDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      zohoPreFill={zohoPreFill}
    />
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ZohoProvider>
        <ActiveProjectProvider>
          <Toaster position="bottom-right" />
          <BrowserRouter>
            <Routes>
              <Route element={<DashboardLayout />}>
                {/* Ebene 1: Overview */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="/projekte" element={<ProjectListPage />} />
                <Route path="/tagesgeschaeft" element={<TagesgeschaeftListPage />} />
                <Route path="/sop" element={<SopPage />} />
                <Route path="/kalender" element={<KalenderPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/einstellungen" element={<TeamPage />} />

                {/* Ebene 2: Project-specific */}
                <Route path="/projekt/:projectId" element={<ProjectDashboardPage />} />
                <Route path="/projekt/:projectId/standorte" element={<StandortePage />} />
                <Route path="/projekt/:projectId/daten" element={<ProjectDataPage />} />
                <Route path="/projekt/:projectId/ist-soll" element={<IstSollPage />} />
                <Route path="/projekt/:projectId/kalkulation" element={<KalkulationPage />} />
                <Route path="/projekt/:projectId/konzept" element={<KonzeptPage />} />
                <Route path="/projekt/:projectId/rolloutliste" element={<RolloutListPage />} />
                <Route path="/projekt/:projectId/sop" element={<SopPage />} />
                <Route path="/projekt/:projectId/logistik" element={<LogistikPage />} />
                <Route path="/projekt/:projectId/it-edv" element={<ItEdvPage />} />
                <Route path="/projekt/:projectId/checklisten" element={<ChecklistenPage />} />
                <Route path="/projekt/:projectId/kalender" element={<KalenderPage />} />
                <Route path="/projekt/:projectId/geraete" element={<DailyGeraeteListePage />} />
                <Route path="/projekt/:projectId/daily" element={<DailyDashboardPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ActiveProjectProvider>
      </ZohoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
