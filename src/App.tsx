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
import Usuarios from "@/pages/Usuarios";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, signIn, signOut } = useAuth();

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
    <AppLayout isAdmin={isAdmin} onSignOut={signOut} userEmail={user.email || ""}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/empresas" element={<Empresas />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/finanzas" element={<Finanzas />} />
        {isAdmin && <Route path="/usuarios" element={<Usuarios />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
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
