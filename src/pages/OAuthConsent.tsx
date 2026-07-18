import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Falta authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Persist consent URL so we can bounce back after sign-in.
        try {
          sessionStorage.setItem(
            "amc_post_login_redirect",
            window.location.pathname + window.location.search,
          );
        } catch {
          /* ignore */
        }
        setNeedsLogin(true);
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("El servidor de autorización no devolvió URL de redirección.");
    }
    window.location.href = target;
  }

  if (needsLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-semibold text-foreground">Autorización</h1>
          <p className="text-sm text-muted-foreground">
            Debes iniciar sesión en AMC antes de aprobar la conexión. Te llevaremos de vuelta aquí al terminar.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => { window.location.href = "/"; }}>
              Iniciar sesión
            </Button>
          </div>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-3">
          <h1 className="text-lg font-semibold text-foreground">Autorización</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
              Volver a AMC
            </Button>
          </div>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "una aplicación externa";
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-lg font-semibold text-foreground">
          Conectar {clientName} a tu cuenta AMC
        </h1>
        <p className="text-sm text-muted-foreground">
          {clientName} podrá usar las herramientas de AMC actuando como tú
          (proyectos, alertas, empresas y clientes visibles según tus permisos).
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Denegar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Aprobar
          </Button>
        </div>
      </div>
    </main>
  );
}