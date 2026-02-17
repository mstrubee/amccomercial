import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  TrendingUp,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import logoAmc from "@/assets/logo-amc.png";

interface Props {
  children: React.ReactNode;
  isAdmin: boolean;
  onSignOut: () => void;
  userEmail: string;
  canAccessSection?: (key: string) => boolean;
}

export default function AppLayout({ children, isAdmin, onSignOut, userEmail, canAccessSection }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const location = useLocation();

  const allNavItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
    { path: "/proyectos", label: "Proyectos", icon: FolderKanban, key: "proyectos" },
    { path: "/finanzas", label: "Finanzas", icon: TrendingUp, key: "finanzas" },
    { path: "/alertas", label: "Alertas", icon: Bell, key: "alertas" },
  ];

  // Filter nav items based on permissions
  const navItems = canAccessSection
    ? allNavItems.filter(item => canAccessSection(item.key))
    : allNavItems;

  const adminSubItems = [
    { path: "/clientes", label: "Clientes" },
    { path: "/categorias", label: "Categorías" },
    { path: "/reporteria", label: "Reportería" },
    { path: "/usuarios", label: "Usuarios" },
    { path: "/empresas", label: "Empresas" },
    { path: "/carga-masiva", label: "Carga Masiva" },
  ];

  const isAdminPathActive = adminSubItems.some((i) => location.pathname === i.path);

  return (
    <div className="flex h-screen overflow-hidden">
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex flex-col bg-sidebar sidebar-glow border-r border-sidebar-border shrink-0"
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <img src={logoAmc} alt="AMC" className="w-8 h-8 rounded-lg object-cover shrink-0" />
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
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-sidebar-primary")} />
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
          {isAdmin && (
            <div>
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                  isAdminPathActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Settings className={cn("w-5 h-5 shrink-0", isAdminPathActive && "text-sidebar-primary")} />
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
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
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

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
