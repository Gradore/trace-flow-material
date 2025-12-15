import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Orders from "./pages/Orders";
import Companies from "./pages/Companies";
import SupplierPortal from "./pages/SupplierPortal";
import CustomerPortal from "./pages/CustomerPortal";
import LogisticsPortal from "./pages/LogisticsPortal";
import AdminUsers from "./pages/AdminUsers";
import ReportingDashboard from "./pages/ReportingDashboard";
import Maintenance from "./pages/Maintenance";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/reporting" element={<ProtectedRoute><AppLayout><ReportingDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/containers" element={<ProtectedRoute><AppLayout><Containers /></AppLayout></ProtectedRoute>} />
            <Route path="/intake" element={<ProtectedRoute><AppLayout><MaterialIntake /></AppLayout></ProtectedRoute>} />
            <Route path="/processing" element={<ProtectedRoute><AppLayout><Processing /></AppLayout></ProtectedRoute>} />
            <Route path="/sampling" element={<ProtectedRoute><AppLayout><Sampling /></AppLayout></ProtectedRoute>} />
            <Route path="/output" element={<ProtectedRoute><AppLayout><OutputMaterials /></AppLayout></ProtectedRoute>} />
            <Route path="/delivery-notes" element={<ProtectedRoute><AppLayout><DeliveryNotes /></AppLayout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><AppLayout><Documents /></AppLayout></ProtectedRoute>} />
            <Route path="/traceability" element={<ProtectedRoute><AppLayout><Traceability /></AppLayout></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><AppLayout><Orders /></AppLayout></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute><AppLayout><Companies /></AppLayout></ProtectedRoute>} />
            <Route path="/supplier-portal" element={<ProtectedRoute><AppLayout><SupplierPortal /></AppLayout></ProtectedRoute>} />
            <Route path="/customer-portal" element={<ProtectedRoute><AppLayout><CustomerPortal /></AppLayout></ProtectedRoute>} />
            <Route path="/logistics" element={<ProtectedRoute><AppLayout><LogisticsPortal /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AppLayout><AdminUsers /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><Users /></AppLayout></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><AppLayout><QRScanner /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><AppLayout><Maintenance /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
