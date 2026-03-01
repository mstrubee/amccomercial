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
import FloatingUserStatus from "@/components/presence/FloatingUserStatus";
import FloatingChat from "@/components/mensajeria/FloatingChat";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import CargaMasiva from "@/pages/CargaMasiva";
import Clientes from "@/pages/Clientes";
import CategoriasPage from "@/pages/CategoriasPage";
import Reporteria from "@/pages/Reporteria";
import EstadosProyectoPage from "@/pages/EstadosProyectoPage";
import RepositorioTipoPage from "@/pages/RepositorioTipoPage";
import DrivePage from "@/pages/DrivePage";

import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isUsuarioTipo1, signIn, signOut, canAccessSection } = useAuth();
  usePresenceHeartbeat(user?.id);

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
    <AppLayout isAdmin={isAdmin} isUsuarioTipo1={isUsuarioTipo1} onSignOut={signOut} userEmail={user.email || ""} canAccessSection={canAccessSection}>
      <Routes>
        <Route path="/" element={canAccessSection("dashboard") ? <Dashboard /> : <Navigate to={canAccessSection("proyectos") ? "/proyectos" : canAccessSection("empresas") ? "/empresas" : canAccessSection("finanzas") ? "/finanzas" : canAccessSection("alertas") ? "/alertas" : "/"} replace />} />
        {canAccessSection("empresas") && <Route path="/empresas" element={<Empresas />} />}
        {canAccessSection("proyectos") && <Route path="/proyectos" element={<Proyectos />} />}
        {canAccessSection("finanzas") && <Route path="/finanzas" element={<Finanzas />} />}
        {canAccessSection("alertas") && <Route path="/alertas" element={<Alertas />} />}
        {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
        {isAdmin && <Route path="/carga-masiva" element={<CargaMasiva />} />}
        {isAdmin && <Route path="/categorias" element={<CategoriasPage />} />}
        {isAdmin && <Route path="/estados-proyecto" element={<EstadosProyectoPage />} />}
        {isAdmin && <Route path="/repositorio-tipo" element={<RepositorioTipoPage />} />}
        {isAdmin && <Route path="/drive" element={<DrivePage />} />}
        {(isAdmin || isUsuarioTipo1) && <Route path="/clientes" element={<Clientes />} />}
        {isAdmin && <Route path="/reporteria" element={<Reporteria />} />}
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AlertaWidget />
      <FloatingChat />
      {isAdmin && <FloatingUserStatus />}
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
