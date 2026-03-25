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
import PlaceholderPage from "./pages/PlaceholderPage";
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
                <Route path="/projekt/:projectId/daten" element={<ProjectDataPage />} />
                <Route path="/projekt/:projectId/rolloutliste" element={<RolloutListPage />} />
                <Route path="/projekt/:projectId/ist-soll" element={<PlaceholderPage title="IST/SOLL Vergleich" />} />
                <Route path="/projekt/:projectId/sop" element={<PlaceholderPage title="SOP / Vorrichten" />} />
                <Route path="/projekt/:projectId/logistik" element={<PlaceholderPage title="Logistik" />} />
                <Route path="/projekt/:projectId/it-edv" element={<PlaceholderPage title="IT / EDV" />} />
                <Route path="/projekt/:projectId/checklisten" element={<PlaceholderPage title="Checklisten" />} />
                <Route path="/projekt/:projectId/kalender" element={<PlaceholderPage title="Kalender" />} />
                <Route path="/kalkulation" element={<PlaceholderPage title="Kalkulation" />} />
                <Route path="/konzept" element={<PlaceholderPage title="Konzept" />} />
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
