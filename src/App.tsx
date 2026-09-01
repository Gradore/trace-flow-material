import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleRoute, RoleLandingRedirect } from "@/components/auth/RoleRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Public / auth pages are small and always needed.
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Everything behind the login is code-split: the app is mobile-first and the
// user opens it on site, often on a phone connection.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Containers = lazy(() => import("./pages/Containers"));
const MaterialIntake = lazy(() => import("./pages/MaterialIntake"));
const Processing = lazy(() => import("./pages/Processing"));
const Sampling = lazy(() => import("./pages/Sampling"));
const OutputMaterials = lazy(() => import("./pages/OutputMaterials"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const Documents = lazy(() => import("./pages/Documents"));
const Traceability = lazy(() => import("./pages/Traceability"));
const Users = lazy(() => import("./pages/Users"));
const QRScanner = lazy(() => import("./pages/QRScanner"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Orders = lazy(() => import("./pages/Orders"));
const Companies = lazy(() => import("./pages/Companies"));
const SupplierPortal = lazy(() => import("./pages/SupplierPortal"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const LogisticsPortal = lazy(() => import("./pages/LogisticsPortal"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const ReportingDashboard = lazy(() => import("./pages/ReportingDashboard"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const RecipeMatching = lazy(() => import("./pages/RecipeMatching"));
const SalesSearch = lazy(() => import("./pages/SalesSearch"));
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const AGB = lazy(() => import("./pages/AGB"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const DatasheetUpload = lazy(() => import("./pages/DatasheetUpload"));
const Archive = lazy(() => import("./pages/Archive"));
const RetentionSamples = lazy(() => import("./pages/RetentionSamples"));
const LabelManagement = lazy(() => import("./pages/LabelManagement"));

// GFK project module (Projektplan)
const ProjectCockpit = lazy(() => import("./pages/project/ProjectCockpit"));
const ProjectTasks = lazy(() => import("./pages/project/ProjectTasks"));
const ProjectPartners = lazy(() => import("./pages/project/ProjectPartners"));
const MaterialBatches = lazy(() => import("./pages/project/MaterialBatches"));
const TestRuns = lazy(() => import("./pages/project/TestRuns"));
const DoeSeriesPage = lazy(() => import("./pages/project/DoeSeriesPage"));
const Fractions = lazy(() => import("./pages/project/Fractions"));
const Analytics = lazy(() => import("./pages/project/Analytics"));
const ProductTests = lazy(() => import("./pages/project/ProductTests"));
const MaterialFlow = lazy(() => import("./pages/project/MaterialFlow"));
const MailTemplates = lazy(() => import("./pages/project/MailTemplates"));
const ProjectRisks = lazy(() => import("./pages/project/ProjectRisks"));
const AiInsights = lazy(() => import("./pages/project/AiInsights"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

/** Guarded page inside the app shell. */
function Guarded({ children }: { children: React.ReactNode }) {
  return (
    <RoleRoute>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </RoleRoute>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Public */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/agb" element={<AGB />} />

                {/* Landing - each role goes to the entry point it may use */}
                <Route
                  path="/"
                  element={
                    <RoleRoute>
                      <RoleLandingRedirect>
                        <Suspense fallback={<PageFallback />}><Dashboard /></Suspense>
                      </RoleLandingRedirect>
                    </RoleRoute>
                  }
                />

                {/* Overview */}
                <Route path="/reporting" element={<Guarded><ReportingDashboard /></Guarded>} />

                {/* GFK project module */}
                <Route path="/projekt" element={<Guarded><ProjectCockpit /></Guarded>} />
                <Route path="/projekt/aufgaben" element={<Guarded><ProjectTasks /></Guarded>} />
                <Route path="/projekt/partner" element={<Guarded><ProjectPartners /></Guarded>} />
                <Route path="/projekt/chargen" element={<Guarded><MaterialBatches /></Guarded>} />
                <Route path="/projekt/versuche" element={<Guarded><TestRuns /></Guarded>} />
                <Route path="/projekt/doe" element={<Guarded><DoeSeriesPage /></Guarded>} />
                <Route path="/projekt/fraktionen" element={<Guarded><Fractions /></Guarded>} />
                <Route path="/projekt/analytik" element={<Guarded><Analytics /></Guarded>} />
                <Route path="/projekt/produkttests" element={<Guarded><ProductTests /></Guarded>} />
                <Route path="/projekt/materialfluss" element={<Guarded><MaterialFlow /></Guarded>} />
                <Route path="/projekt/mailvorlagen" element={<Guarded><MailTemplates /></Guarded>} />
                <Route path="/projekt/risiken" element={<Guarded><ProjectRisks /></Guarded>} />
                <Route path="/projekt/ki" element={<Guarded><AiInsights /></Guarded>} />

                {/* Operations */}
                <Route path="/intake" element={<Guarded><MaterialIntake /></Guarded>} />
                <Route path="/containers" element={<Guarded><Containers /></Guarded>} />
                <Route path="/processing" element={<Guarded><Processing /></Guarded>} />
                <Route path="/sampling" element={<Guarded><Sampling /></Guarded>} />
                <Route path="/output" element={<Guarded><OutputMaterials /></Guarded>} />
                <Route path="/retention-samples" element={<Guarded><RetentionSamples /></Guarded>} />
                <Route path="/maintenance" element={<Guarded><Maintenance /></Guarded>} />

                {/* Commerce & logistics */}
                <Route path="/orders" element={<Guarded><Orders /></Guarded>} />
                <Route path="/companies" element={<Guarded><Companies /></Guarded>} />
                <Route path="/delivery-notes" element={<Guarded><DeliveryNotes /></Guarded>} />
                <Route path="/logistics" element={<Guarded><LogisticsPortal /></Guarded>} />

                {/* Documents & traceability */}
                <Route path="/documents" element={<Guarded><Documents /></Guarded>} />
                <Route path="/datasheet-upload" element={<Guarded><DatasheetUpload /></Guarded>} />
                <Route path="/labels" element={<Guarded><LabelManagement /></Guarded>} />
                <Route path="/traceability" element={<Guarded><Traceability /></Guarded>} />
                <Route path="/archive" element={<Guarded><Archive /></Guarded>} />

                {/* AI tools */}
                <Route path="/recipe-matching" element={<Guarded><RecipeMatching /></Guarded>} />
                <Route path="/sales-search" element={<Guarded><SalesSearch /></Guarded>} />

                {/* Portals */}
                <Route path="/customer-portal" element={<Guarded><CustomerPortal /></Guarded>} />
                <Route path="/supplier-portal" element={<Guarded><SupplierPortal /></Guarded>} />

                {/* Administration */}
                <Route path="/users" element={<Guarded><Users /></Guarded>} />
                <Route path="/admin/users" element={<Guarded><AdminUsers /></Guarded>} />
                <Route path="/audit-logs" element={<Guarded><AuditLogs /></Guarded>} />
                <Route path="/settings" element={<Guarded><Settings /></Guarded>} />
                <Route path="/admin-settings" element={<Guarded><AdminSettings /></Guarded>} />
                <Route path="/api-docs" element={<Guarded><ApiDocs /></Guarded>} />

                {/* Account & tools */}
                <Route path="/profile" element={<Guarded><Profile /></Guarded>} />
                <Route path="/scan" element={<Guarded><QRScanner /></Guarded>} />

                <Route
                  path="*"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <NotFound />
                    </Suspense>
                  }
                />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
