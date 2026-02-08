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

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y contraseña requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email },
    });

    if (createError) {
      // If user already exists, find them and assign admin role
      if (createError.message.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users?.find((u) => u.email === email);
        if (existing) {
          await supabaseAdmin.from("user_roles").upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
          return new Response(JSON.stringify({ success: true, message: "Admin role assigned to existing user" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      throw createError;
    }

    // Assign admin role
    if (newUser.user) {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
