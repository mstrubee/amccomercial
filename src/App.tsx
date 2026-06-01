import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import AlertaWidget from "@/components/alertas/AlertaWidget";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { Loader2 } from "lucide-react";
import { NotasModoProvider } from "@/contexts/NotasModoContext";
import NotasModoPanel from "@/components/notas/NotasModoPanel";
import NotasModoOverlay from "@/components/notas/NotasModoOverlay";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Empresas = lazy(() => import("@/pages/Empresas"));
const Proyectos = lazy(() => import("@/pages/Proyectos"));
const Finanzas = lazy(() => import("@/pages/Finanzas"));
const Alertas = lazy(() => import("@/pages/Alertas"));
const Usuarios = lazy(() => import("@/pages/Usuarios"));
const CargaMasiva = lazy(() => import("@/pages/CargaMasiva"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const CategoriasPage = lazy(() => import("@/pages/CategoriasPage"));
const Reporteria = lazy(() => import("@/pages/Reporteria"));
const EstadosProyectoPage = lazy(() => import("@/pages/EstadosProyectoPage"));
const EstadosAmcPage = lazy(() => import("@/pages/EstadosAmcPage"));
const RepositorioTipoPage = lazy(() => import("@/pages/RepositorioTipoPage"));
const DrivePage = lazy(() => import("@/pages/DrivePage"));
const Calendario = lazy(() => import("@/pages/Calendario"));
const ReunionesPage = lazy(() => import("@/pages/AtencionEmpresas"));
const HitosEjecucionPage = lazy(() => import("@/pages/HitosEjecucionPage"));
const AdminNotas = lazy(() => import("@/pages/AdminNotas"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageFallback = () => (
  <div className="flex flex-1 items-center justify-center py-20">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  </div>
);

// Stable singleton — survives HMR reloads
let _qc: QueryClient | null = null;
function getQueryClient() {
  if (!_qc) {
    _qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 2 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
  }
  return _qc;
}

function AppRoutes() {
  const { user, loading, isAdmin, isUsuarioTipo1, signIn, signOut, canAccessSection } = useAuth();
  const { data: theme } = useThemeSettings();
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
    <NotasModoProvider>
    <AppLayout isAdmin={isAdmin} isUsuarioTipo1={isUsuarioTipo1} onSignOut={signOut} userEmail={user.email || ""} canAccessSection={canAccessSection}>
      <NotasModoOverlay />
      <Suspense fallback={<PageFallback />}>
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
          {isAdmin && <Route path="/estados-amc" element={<EstadosAmcPage />} />}
          {isAdmin && <Route path="/repositorio-tipo" element={<RepositorioTipoPage />} />}
          {isAdmin && <Route path="/drive" element={<DrivePage />} />}
          {isAdmin && <Route path="/hitos-ejecucion" element={<HitosEjecucionPage />} />}
          {isAdmin && <Route path="/notas" element={<AdminNotas />} />}
          {(isAdmin || isUsuarioTipo1) && <Route path="/clientes" element={<Clientes />} />}
          {isAdmin && <Route path="/reporteria" element={<Reporteria />} />}
          <Route path="/calendario" element={<Calendario />} />
          {(isAdmin || isUsuarioTipo1) && <Route path="/atencion-empresas" element={<ReunionesPage />} />}
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AlertaWidget />
      {(() => {
        const pos = theme?.theme_floating_position || "left-14";
        const [side, idxStr] = pos.split("-");
        const idx = parseInt(idxStr || "14", 10);
        let style: React.CSSProperties = {};
        if (side === "left") {
          const pct = 5 + (90 * idx) / 14;
          style = { left: 16, top: `${pct}%`, position: "fixed" };
        } else if (side === "right") {
          const pct = 5 + (90 * idx) / 14;
          style = { right: 16, top: `${pct}%`, position: "fixed" };
        } else {
          const pct = 8 + (84 * idx) / 14;
          style = { left: `${pct}%`, bottom: 16, position: "fixed" };
        }
        return (
          <div className="z-50 flex items-center gap-2" style={style}>
            {isAdmin && <FloatingUserStatus />}
            <FloatingChat />
          </div>
        );
      })()}
      {isAdmin && <NotasModoPanel />}
    </AppLayout>
    </NotasModoProvider>
  );
}

const App = () => (
  <QueryClientProvider client={getQueryClient()}>
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
