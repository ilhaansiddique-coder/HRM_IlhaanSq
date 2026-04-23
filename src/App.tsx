import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { dismissibleToast } from "@/components/DismissibleToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/core/auth/useAuth";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import { ThemeProvider } from "next-themes";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { PwaInstallGateway } from "@/components/PwaInstallGateway";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PasswordResetGuard } from "@/components/PasswordResetGuard";
import { useFavicon } from "@/hooks/useFavicon";
import { usePwaUpdateChannel } from "@/hooks/usePwaUpdateChannel";
import { migrateInsecureBackups } from "@/utils/secureStorage";
import { Loader2 } from "lucide-react";
import Index from "./views/Index";
import Landing from "./views/Landing";
import DemoRequestPage from "./views/DemoRequestPage";
import Products from "./views/Products";
import Inventory from "./views/Inventory";
import Sales from "./views/Sales";
import Packaging from "./views/Packaging";
import Customers from "./views/Customers";
import HRManagement from "./views/HRManagement";
import Reports from "./views/Reports";
import SalesCaseStudy2026 from "./views/SalesCaseStudy2026";
import Invoices from "./views/Invoices";
import Alerts from "./views/Alerts";
import Settings from "./views/Settings";
import Admin from "./views/Admin";
import SuperAdminDashboard from "./views/SuperAdminDashboard";
import UserProfile from "./views/UserProfile";
import Auth from "./views/Auth";
import ForcePasswordReset from "./views/ForcePasswordReset";
import Invite from "./views/Invite";
import Onboarding from "./views/Onboarding";
import NotFound from "./views/NotFound";
import Trash from "./views/Trash";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const errorMeta = error as { code?: string; message?: string; status?: number } | null;
        const message = String(errorMeta?.message || "").toLowerCase();
        const isClientOrSchemaError =
          errorMeta?.status === 400 ||
          String(errorMeta?.code || "").toUpperCase().startsWith("PGRST") ||
          errorMeta?.code === "42703" ||
          errorMeta?.code === "22P02" ||
          message.includes("400") ||
          message.includes("schema cache") ||
          message.includes("does not exist") ||
          message.includes("column");
        if (isClientOrSchemaError) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Component to handle favicon updates
const FaviconUpdater = () => {
  useFavicon();
  return null;
};

// Security: Clean up old insecure localStorage data on startup
const SecurityInitializer = () => {
  React.useEffect(() => {
    migrateInsecureBackups();
  }, []);
  return null;
};

const PwaUpdateListener = () => {
  usePwaUpdateChannel();
  return null;
};

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const ProtectedAppLayout = () => (
  <PasswordResetGuard>
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  </PasswordResetGuard>
);

// Component to handle routing with first-time setup check
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/request-demo" element={<DemoRequestPage />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/invite" element={<Invite />} />
      <Route path="/reset-password" element={
        <ProtectedRoute>
          <ForcePasswordReset />
        </ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute allowWithoutTenant>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route element={<ProtectedAppLayout />}>
        <Route path="/dashboard" element={
          <ProtectedRoute requiredPermission="access.dashboard">
            <Index />
          </ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute requiredPermission="products.view">
            <Products />
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute requiredPermission="inventory.view">
            <Inventory />
          </ProtectedRoute>
        } />
        <Route path="/sales" element={
          <ProtectedRoute requiredPermission="sales.view">
            <Sales />
          </ProtectedRoute>
        } />
        <Route path="/packaging" element={
          <ProtectedRoute requiredPermission="packaging.view">
            <Packaging />
          </ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute requiredPermission="customers.view">
            <Customers />
          </ProtectedRoute>
        } />
        <Route path="/hr-management" element={
          <ProtectedRoute requiredPermission="hr.view">
            <HRManagement />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute requiredPermission="reports.view">
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="/reports/case-study-sales-2026" element={
          <ProtectedRoute requiredPermission="reports.view">
            <SalesCaseStudy2026 />
          </ProtectedRoute>
        } />
        <Route path="/invoices" element={
          <ProtectedRoute requiredPermission="invoices.view">
            <Invoices />
          </ProtectedRoute>
        } />
        <Route path="/alerts" element={
          <ProtectedRoute requiredPermission="access.alerts">
            <Alerts />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute requiredPermission="settings.view_business">
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/users/:userId" element={<UserProfile />} />
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="tenant_admin">
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/super-admin" element={
          <ProtectedRoute requiredRole="superadmin">
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/trash" element={<Trash />} />
      </Route>
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <ThemeInitializer />
        <FaviconUpdater />
        <PwaUpdateListener />
        <SecurityInitializer />
        <SystemSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_relativeSplatPath: true,
                v7_startTransition: true,
              }}
            >
              <PwaInstallGateway />
              <React.Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </React.Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </SystemSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
