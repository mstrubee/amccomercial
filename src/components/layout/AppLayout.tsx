import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  TrendingUp,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  ChevronDown,
  Palette,
  Users,
  Tags,
  ListChecks,
  BarChart3,
  Upload,
    FolderTree,
    HardDrive,
    ClipboardCheck,
    ClipboardList,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import logoAmc from "@/assets/logo-amc.png";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import PersonalizacionDialog from "@/components/personalizacion/PersonalizacionDialog";

interface Props {
  children: React.ReactNode;
  isAdmin: boolean;
  isUsuarioTipo1?: boolean;
  onSignOut: () => void;
  userEmail: string;
  canAccessSection?: (key: string) => boolean;
}

export default function AppLayout({ children, isAdmin, isUsuarioTipo1, onSignOut, userEmail, canAccessSection }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [personalizacionOpen, setPersonalizacionOpen] = useState(false);
  const location = useLocation();
  const { data: theme } = useThemeSettings();

  const sidebarStyle: React.CSSProperties = {
    ...(theme?.theme_sidebar_bg ? { backgroundColor: theme.theme_sidebar_bg } : {}),
    ...(theme?.theme_sidebar_text ? { color: theme.theme_sidebar_text } : {}),
  };
  const accentBg = theme?.theme_accent_color || undefined;
  const logoSrc = theme?.theme_company_logo || logoAmc;

  const allNavItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
    { path: "/proyectos", label: "Proyectos", icon: FolderKanban, key: "proyectos" },
    { path: "/finanzas", label: "Finanzas", icon: TrendingUp, key: "finanzas" },
    { path: "/alertas", label: "Tareas y Alertas", icon: Bell, key: "alertas" },
    { path: "/atencion-empresas", label: "Reuniones", icon: ClipboardCheck, key: "reuniones" },
    { path: "/calendario", label: "Calendario", icon: CalendarDays, key: "calendario" },
  ];

  const navItems = canAccessSection
    ? allNavItems.filter(item => item.key === "calendario" || canAccessSection(item.key))
    : allNavItems;

  const allAdminSubItems: { path: string; label: string; allowTipo1: boolean; icon: LucideIcon }[] = [
    { path: "/clientes", label: "Clientes y Captadores", allowTipo1: true, icon: Users },
    { path: "/categorias", label: "Estatus (x Empresa)", allowTipo1: false, icon: Tags },
    { path: "/estados-proyecto", label: "Estado (x Proyecto)", allowTipo1: false, icon: ListChecks },
    { path: "/estados-amc", label: "Estado AMC (x Empresa)", allowTipo1: false, icon: ListChecks },
    { path: "/reporteria", label: "Reportería", allowTipo1: false, icon: BarChart3 },
    { path: "/usuarios", label: "Usuarios", allowTipo1: false, icon: Users },
    { path: "/empresas", label: "Empresas", allowTipo1: false, icon: Building2 },
    { path: "/carga-masiva", label: "Carga Masiva", allowTipo1: false, icon: Upload },
    { path: "/repositorio-tipo", label: "Repositorio Tipo", allowTipo1: false, icon: FolderTree },
    { path: "/drive", label: "Drive", allowTipo1: false, icon: HardDrive },
    { path: "/hitos-ejecucion", label: "Hitos Ejecución Proyectos", allowTipo1: false, icon: ClipboardList },
  ];

  const adminSubItems = isAdmin
    ? allAdminSubItems
    : isUsuarioTipo1
      ? allAdminSubItems.filter(i => i.allowTipo1)
      : [];

  const showAdminSection = adminSubItems.length > 0;
  const isAdminPathActive = adminSubItems.some((i) => location.pathname === i.path);

  return (
    <div className="flex h-screen overflow-hidden">
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex flex-col bg-sidebar sidebar-glow border-r border-sidebar-border shrink-0"
        style={sidebarStyle}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <img src={logoSrc} alt="Logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <h1 className="text-sidebar-accent-foreground font-bold text-lg tracking-tight whitespace-nowrap">AMC</h1>
                <p className="text-sidebar-muted text-[10px] leading-none whitespace-nowrap">Gestión Comercial</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
                style={isActive && accentBg ? { backgroundColor: `${accentBg}33` } : undefined}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-sidebar-primary")} style={isActive && accentBg ? { color: accentBg } : undefined} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="whitespace-nowrap">
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}

          {/* Admin dropdown */}
          {showAdminSection && (
            <div>
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                  isAdminPathActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
                style={isAdminPathActive && accentBg ? { backgroundColor: `${accentBg}33` } : undefined}
              >
                <Settings className={cn("w-5 h-5 shrink-0", isAdminPathActive && "text-sidebar-primary")} style={isAdminPathActive && accentBg ? { color: accentBg } : undefined} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="whitespace-nowrap flex-1 text-left flex items-center justify-between">
                      Administración
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", adminOpen && "rotate-180")} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <AnimatePresence>
                {adminOpen && !collapsed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden ml-5 mt-1 space-y-0.5">
                    {adminSubItems.map((sub) => {
                      const isActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={cn(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground"
                          )}
                          style={isActive && accentBg ? { backgroundColor: `${accentBg}33`, color: theme?.theme_sidebar_text || undefined } : undefined}
                        >
                          <span className="flex items-center gap-1.5">
                            <sub.icon className="w-3.5 h-3.5" />
                            {sub.label}
                          </span>
                        </Link>
                      );
                    })}
                    {/* Personalización button (admin only) */}
                    {isAdmin && (
                      <button
                        onClick={() => setPersonalizacionOpen(true)}
                        className="w-full text-left block px-3 py-2 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground"
                      >
                        <span className="flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" />
                          Personalización
                        </span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        {/* User & Logout */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <AnimatePresence>
            {!collapsed && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sidebar-muted text-[10px] truncate mb-1 px-3">
                {userEmail}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="whitespace-nowrap">
                  Cerrar Sesión
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </motion.aside>

      <main className="flex-1 overflow-hidden">
        <div className="p-8 h-full overflow-auto">{children}</div>
      </main>

      {/* Personalización Dialog */}
      <PersonalizacionDialog open={personalizacionOpen} onOpenChange={setPersonalizacionOpen} />
    </div>
  );
}
