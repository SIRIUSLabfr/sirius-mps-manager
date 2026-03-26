import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZohoProvider } from "@/hooks/useZoho";
import { ActiveProjectProvider } from "@/hooks/useActiveProject";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ZohoProvider>
        <ActiveProjectProvider>
          <Toaster position="bottom-right" />
          <BrowserRouter>
            <Routes>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<ProjectListPage />} />
                <Route path="/projekt/:projectId" element={<ProjectDashboardPage />} />
                <Route path="/projekt/:projectId/standorte" element={<StandortePage />} />
                <Route path="/projekt/:projectId/daten" element={<ProjectDataPage />} />
                <Route path="/projekt/:projectId/rolloutliste" element={<RolloutListPage />} />
                <Route path="/projekt/:projectId/ist-soll" element={<IstSollPage />} />
                <Route path="/projekt/:projectId/sop" element={<SopPage />} />
                <Route path="/projekt/:projectId/logistik" element={<LogistikPage />} />
                <Route path="/projekt/:projectId/it-edv" element={<ItEdvPage />} />
                <Route path="/projekt/:projectId/checklisten" element={<ChecklistenPage />} />
                <Route path="/projekt/:projectId/kalender" element={<KalenderPage />} />
                <Route path="/kalkulation" element={<KalkulationPage />} />
                <Route path="/konzept" element={<KonzeptPage />} />
                <Route path="/einstellungen" element={<TeamPage />} />
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
