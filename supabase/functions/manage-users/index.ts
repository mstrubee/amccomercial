import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      const { data: allRoles } = await supabaseAdmin.from("user_roles").select("*");
      const { data: allProfiles } = await supabaseAdmin.from("profiles").select("*");

      const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: allProfiles?.find((p) => p.user_id === u.id)?.display_name || u.email,
        created_at: u.created_at,
        roles: allRoles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [],
      }));

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { email, password, display_name, role } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email y contraseña requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email },
      });
      if (createError) throw createError;

      if (role && newUser.user) {
        await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
      }

      return new Response(JSON.stringify({ id: newUser.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { user_id, email, password, display_name, role } = body;
      
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (display_name) updateData.user_metadata = { display_name };

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, updateData);
        if (error) throw error;
      }

      if (display_name) {
        await supabaseAdmin.from("profiles").update({ display_name, email: email || undefined }).eq("user_id", user_id);
      }

      if (role !== undefined) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
        if (role) {
          await supabaseAdmin.from("user_roles").insert({ user_id, role });
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "No puedes eliminarte a ti mismo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("manage-users error:", err);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
