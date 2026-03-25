import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZohoProvider } from "@/hooks/useZoho";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ZohoProvider>
        <Toaster position="bottom-right" />
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/projektdaten" element={<PlaceholderPage title="Projektdaten" />} />
              <Route path="/ist-soll" element={<PlaceholderPage title="IST/SOLL Vergleich" />} />
              <Route path="/rolloutliste" element={<PlaceholderPage title="Rolloutliste" />} />
              <Route path="/sop" element={<PlaceholderPage title="SOP / Vorrichten" />} />
              <Route path="/logistik" element={<PlaceholderPage title="Logistik" />} />
              <Route path="/it-edv" element={<PlaceholderPage title="IT / EDV" />} />
              <Route path="/checklisten" element={<PlaceholderPage title="Checklisten" />} />
              <Route path="/kalender" element={<PlaceholderPage title="Kalender" />} />
              <Route path="/kalkulation" element={<PlaceholderPage title="Kalkulation" />} />
              <Route path="/konzept" element={<PlaceholderPage title="Konzept" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ZohoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
