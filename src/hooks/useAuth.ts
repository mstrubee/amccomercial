import { useState, useEffect, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "usuario_tipo_1" | "usuario_tipo_2";

export interface UserPermissionsData {
  empresas_visibles: string[] | null;
  secciones_visibles: string[] | null;
  dashboard_widgets: string[] | null;
  puede_editar: boolean;
  secciones_solo_asignados: string[] | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermissionsData | null>(null);
  const [captadorId, setCaptadorId] = useState<string | null>(null);
  // SEC-002: whether roles+permissions loaded successfully at least once for the
  // current user. The access helpers fail CLOSED while this is false so that a
  // failed/errored fetch is never mistaken for "unrestricted user". It is
  // distinct from `permissions === null`, which legitimately means "user has no
  // restriction row" once the fetch has actually succeeded.
  const [permsReady, setPermsReady] = useState(false);
  const fetchedUserId = useRef<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const fetchPermissions = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_permissions")
      .select("empresas_visibles, secciones_visibles, dashboard_widgets, puede_editar, secciones_solo_asignados")
      .eq("user_id", userId)
      .maybeSingle();
    // On a realtime refetch error, keep the last known state instead of
    // dropping to an "open" null — do not flip permsReady off.
    if (error) {
      console.error("[useAuth] refetch de permisos falló:", error.message);
      return;
    }
    setPermissions(data as UserPermissionsData | null);
    setPermsReady(true);
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    if (fetchedUserId.current === userId) return;

    const [rolesRes, permsRes, captadorRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions")
        .select("empresas_visibles, secciones_visibles, dashboard_widgets, puede_editar, secciones_solo_asignados")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("captadores" as any).select("id").eq("user_id", userId).maybeSingle(),
    ]);

    // Fail-closed on error: do NOT apply partial/opened state, and retry with
    // exponential backoff. Marking fetchedUserId only on success lets the retry
    // (and any future auth event) re-run the fetch.
    if (rolesRes.error || permsRes.error) {
      console.error(
        "[useAuth] fetch de roles/permisos falló, reintentando:",
        rolesRes.error?.message || permsRes.error?.message,
      );
      setPermsReady(false);
      setLoading(false);
      const attempt = retryCount.current++;
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        void fetchUserData(userId);
      }, delay);
      return;
    }

    fetchedUserId.current = userId;
    retryCount.current = 0;
    setRoles(rolesRes.data ? rolesRes.data.map((r) => r.role as AppRole) : []);
    setPermissions(permsRes.data as UserPermissionsData | null);
    setCaptadorId((captadorRes.data as any)?.id ?? null);
    setPermsReady(true);
    // SEC-001: setLoading(false) moved here so roles/permissions are always
    // available before the app renders protected routes for the first time.
    setLoading(false);
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
          retryCount.current = 0;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          setRoles([]);
          setPermissions(null);
          setPermsReady(false);
          setCaptadorId(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // fetchUserData calls setLoading(false) once roles/permissions resolve.
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [fetchUserData]);

  // Realtime: re-fetch permissions whenever user_permissions changes for this user.
  // This ensures captadores see their assigned projects immediately after an admin
  // assigns or removes empresas, without needing to log out and back in.
  useEffect(() => {
    if (!user) return;
    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`user_permissions:${user.id}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_permissions",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchPermissions(user.id)
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, fetchPermissions]);

  const isAdmin = roles.includes("admin");
  const isUsuarioTipo1 = roles.includes("usuario_tipo_1");
  const isCaptador = captadorId !== null;

  const canAccessSection = (sectionKey: string): boolean => {
    if (isAdmin) return true;
    // Fail closed until roles+permissions have loaded successfully.
    if (!permsReady) return false;
    if (!permissions || permissions.secciones_visibles === null) return true;
    return permissions.secciones_visibles.includes(sectionKey);
  };

  const canSeeDashboardWidget = (widgetKey: string): boolean => {
    if (isAdmin) return true;
    if (!permsReady) return false;
    if (!permissions || permissions.dashboard_widgets === null) return true;
    return permissions.dashboard_widgets.includes(widgetKey);
  };

  const canEdit = isAdmin || (permsReady && (!permissions || permissions.puede_editar));

  const canSeeEmpresa = (empresaId: string): boolean => {
    if (isAdmin) return true;
    if (!permsReady) return false;
    if (!permissions || permissions.empresas_visibles === null) return true;
    return permissions.empresas_visibles.includes(empresaId);
  };

  const isSectionRestrictedToAssigned = (sectionKey: string): boolean => {
    if (isAdmin) return false;
    if (!permissions || permissions.empresas_visibles === null) return false;
    const arr = permissions.secciones_solo_asignados;
    // Default behavior: empresas/proyectos restricted when permissions exist
    if (arr === null || arr === undefined) return sectionKey === "empresas" || sectionKey === "proyectos";
    return arr.includes(sectionKey);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user, session, loading, roles, isAdmin, isUsuarioTipo1, isCaptador, captadorId,
    permissions, canAccessSection, canSeeDashboardWidget, canEdit, canSeeEmpresa,
    isSectionRestrictedToAssigned,
    signIn, signOut,
  };
}
