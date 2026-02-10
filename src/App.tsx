import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Empresas from "@/pages/Empresas";
import Proyectos from "@/pages/Proyectos";
import Finanzas from "@/pages/Finanzas";
import Alertas from "@/pages/Alertas";
import Usuarios from "@/pages/Usuarios";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import AlertaWidget from "@/components/alertas/AlertaWidget";
import CargaMasiva from "@/pages/CargaMasiva";
import Clientes from "@/pages/Clientes";
import CategoriasPage from "@/pages/CategoriasPage";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, signIn, signOut, canAccessSection } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={signIn} />;
  }

  return (
    <AppLayout isAdmin={isAdmin} onSignOut={signOut} userEmail={user.email || ""} canAccessSection={canAccessSection}>
      <Routes>
        {canAccessSection("dashboard") && <Route path="/" element={<Dashboard />} />}
        {canAccessSection("empresas") && <Route path="/empresas" element={<Empresas />} />}
        {canAccessSection("proyectos") && <Route path="/proyectos" element={<Proyectos />} />}
        {canAccessSection("finanzas") && <Route path="/finanzas" element={<Finanzas />} />}
        {canAccessSection("alertas") && <Route path="/alertas" element={<Alertas />} />}
        {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
        {isAdmin && <Route path="/carga-masiva" element={<CargaMasiva />} />}
        {isAdmin && <Route path="/categorias" element={<CategoriasPage />} />}
        {isAdmin && <Route path="/clientes" element={<Clientes />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AlertaWidget />
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
