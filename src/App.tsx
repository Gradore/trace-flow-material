import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Containers from "./pages/Containers";
import MaterialIntake from "./pages/MaterialIntake";
import Processing from "./pages/Processing";
import Sampling from "./pages/Sampling";
import OutputMaterials from "./pages/OutputMaterials";
import DeliveryNotes from "./pages/DeliveryNotes";
import Documents from "./pages/Documents";
import Traceability from "./pages/Traceability";
import Users from "./pages/Users";
import QRScanner from "./pages/QRScanner";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/containers" element={<AppLayout><Containers /></AppLayout>} />
          <Route path="/intake" element={<AppLayout><MaterialIntake /></AppLayout>} />
          <Route path="/processing" element={<AppLayout><Processing /></AppLayout>} />
          <Route path="/sampling" element={<AppLayout><Sampling /></AppLayout>} />
          <Route path="/output" element={<AppLayout><OutputMaterials /></AppLayout>} />
          <Route path="/delivery-notes" element={<AppLayout><DeliveryNotes /></AppLayout>} />
          <Route path="/documents" element={<AppLayout><Documents /></AppLayout>} />
          <Route path="/traceability" element={<AppLayout><Traceability /></AppLayout>} />
          <Route path="/users" element={<AppLayout><Users /></AppLayout>} />
          <Route path="/scan" element={<AppLayout><QRScanner /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
