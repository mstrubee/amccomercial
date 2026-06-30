import { lazy, Suspense, type ComponentType } from "react";
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

// Lazy-loaded pages with stale-chunk auto-recovery.
// On dynamic-import failure (common after a redeploy when the cached
// index-*.js references chunks that no longer exist) retry once, then
// force a one-time hard reload to fetch the fresh bundle.
const RELOAD_FLAG = "__lov_chunk_reload__";
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkErr =
        msg.includes("Importing a module script failed") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError");
      if (isChunkErr && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Return a never-resolving promise so Suspense keeps the fallback
        // until the reload completes.
        return await new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Empresas = lazyWithRetry(() => import("@/pages/Empresas"));
const Proyectos = lazyWithRetry(() => import("@/pages/Proyectos"));
const Finanzas = lazyWithRetry(() => import("@/pages/Finanzas"));
const Alertas = lazyWithRetry(() => import("@/pages/Alertas"));
const Usuarios = lazyWithRetry(() => import("@/pages/Usuarios"));
const CargaMasiva = lazyWithRetry(() => import("@/pages/CargaMasiva"));
const Clientes = lazyWithRetry(() => import("@/pages/Clientes"));
const CategoriasPage = lazyWithRetry(() => import("@/pages/CategoriasPage"));
const Reporteria = lazyWithRetry(() => import("@/pages/Reporteria"));
const EstadosProyectoPage = lazyWithRetry(() => import("@/pages/EstadosProyectoPage"));
const EstadosAmcPage = lazyWithRetry(() => import("@/pages/EstadosAmcPage"));
const RepositorioTipoPage = lazyWithRetry(() => import("@/pages/RepositorioTipoPage"));
const DrivePage = lazyWithRetry(() => import("@/pages/DrivePage"));
const Calendario = lazyWithRetry(() => import("@/pages/Calendario"));
const ReunionesPage = lazyWithRetry(() => import("@/pages/AtencionEmpresas"));
const HitosEjecucionPage = lazyWithRetry(() => import("@/pages/HitosEjecucionPage"));
const AdminNotas = lazyWithRetry(() => import("@/pages/AdminNotas"));
const Menciones = lazyWithRetry(() => import("@/pages/Menciones"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

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
  const { user, loading, isAdmin, isUsuarioTipo1, isCaptador, signIn, signOut, canAccessSection } = useAuth();
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
    <AppLayout isAdmin={isAdmin} isUsuarioTipo1={isUsuarioTipo1} isCaptador={isCaptador} onSignOut={signOut} userEmail={user.email || ""} canAccessSection={canAccessSection}>
      <NotasModoOverlay />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={canAccessSection("dashboard") ? <Dashboard /> : <Navigate to={canAccessSection("proyectos") ? "/proyectos" : canAccessSection("empresas") ? "/empresas" : canAccessSection("finanzas") ? "/finanzas" : canAccessSection("alertas") ? "/alertas" : "/"} replace />} />
          {canAccessSection("empresas") && <Route path="/empresas" element={<Empresas />} />}
          {canAccessSection("proyectos") && <Route path="/proyectos" element={<Proyectos />} />}
          {canAccessSection("finanzas") && <Route path="/finanzas" element={<Finanzas />} />}
          {canAccessSection("alertas") && <Route path="/alertas" element={<Alertas />} />}
          {canAccessSection("alertas") && <Route path="/menciones" element={<Menciones />} />}
          {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
          {isAdmin && <Route path="/carga-masiva" element={<CargaMasiva />} />}
          {isAdmin && <Route path="/categorias" element={<CategoriasPage />} />}
          {isAdmin && <Route path="/estados-proyecto" element={<EstadosProyectoPage />} />}
          {isAdmin && <Route path="/estados-amc" element={<EstadosAmcPage />} />}
          {isAdmin && <Route path="/repositorio-tipo" element={<RepositorioTipoPage />} />}
          {isAdmin && <Route path="/drive" element={<DrivePage />} />}
          {isAdmin && <Route path="/hitos-ejecucion" element={<HitosEjecucionPage />} />}
          {isAdmin && <Route path="/notas" element={<AdminNotas />} />}
          {(isAdmin || isUsuarioTipo1 || isCaptador) && <Route path="/clientes" element={<Clientes />} />}
          {isAdmin && <Route path="/reporteria" element={<Reporteria />} />}
          <Route path="/calendario" element={<Calendario />} />
          {(isAdmin || isUsuarioTipo1) && <Route path="/atencion-empresas" element={<ReunionesPage />} />}
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AlertaWidget />
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
