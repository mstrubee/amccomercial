import { useState, useEffect, useCallback, useRef } from "react";
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
  const fetchedUserId = useRef<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // Avoid duplicate fetches for the same user
    if (fetchedUserId.current === userId) return;
    fetchedUserId.current = userId;

    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions")
        .select("empresas_visibles, secciones_visibles, dashboard_widgets, puede_editar")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r) => r.role as AppRole));
    }
    setPermissions(permsRes.data as UserPermissionsData | null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id);
        } else {
          fetchedUserId.current = null;
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
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const isAdmin = roles.includes("admin");
  const isUsuarioTipo1 = roles.includes("usuario_tipo_1");

  const canAccessSection = (sectionKey: string): boolean => {
    if (isAdmin) return true;
    if (!permissions || permissions.secciones_visibles === null) return true;
    return permissions.secciones_visibles.includes(sectionKey);
  };

  const canSeeDashboardWidget = (widgetKey: string): boolean => {
    if (isAdmin) return true;
    if (!permissions || permissions.dashboard_widgets === null) return true;
    return permissions.dashboard_widgets.includes(widgetKey);
  };

  const canEdit = isAdmin || !permissions || permissions.puede_editar;

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
    user, session, loading, roles, isAdmin, isUsuarioTipo1, permissions,
    canAccessSection, canSeeDashboardWidget, canEdit, canSeeEmpresa,
    signIn, signOut,
  };
}
