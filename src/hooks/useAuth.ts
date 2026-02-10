import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "usuario_tipo_1" | "usuario_tipo_2";

export interface UserPermissionsData {
  empresas_visibles: string[] | null;
  secciones_visibles: string[] | null;
  dashboard_widgets: string[] | null;
  puede_editar: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermissionsData | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchRoles(session.user.id);
            fetchPermissions(session.user.id);
          }, 0);
        } else {
          setRoles([]);
          setPermissions(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchRoles(session.user.id);
        fetchPermissions(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (data) {
      setRoles(data.map((r) => r.role as AppRole));
    }
  };

  const fetchPermissions = async (userId: string) => {
    const { data } = await supabase
      .from("user_permissions")
      .select("empresas_visibles, secciones_visibles, dashboard_widgets, puede_editar")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setPermissions(data as UserPermissionsData);
    } else {
      setPermissions(null); // null = all access
    }
  };

  const isAdmin = roles.includes("admin");

  // Helper: check if a section is visible
  const canAccessSection = (sectionKey: string): boolean => {
    if (isAdmin) return true;
    if (!permissions || permissions.secciones_visibles === null) return true;
    return permissions.secciones_visibles.includes(sectionKey);
  };

  // Helper: check if a dashboard widget is visible
  const canSeeDashboardWidget = (widgetKey: string): boolean => {
    if (isAdmin) return true;
    if (!permissions || permissions.dashboard_widgets === null) return true;
    return permissions.dashboard_widgets.includes(widgetKey);
  };

  // Helper: check if user can edit
  const canEdit = isAdmin || !permissions || permissions.puede_editar;

  // Helper: check if an empresa is visible
  const canSeeEmpresa = (empresaId: string): boolean => {
    if (isAdmin) return true;
    if (!permissions || permissions.empresas_visibles === null) return true;
    return permissions.empresas_visibles.includes(empresaId);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user, session, loading, roles, isAdmin, permissions,
    canAccessSection, canSeeDashboardWidget, canEdit, canSeeEmpresa,
    signIn, signOut,
  };
}
