import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Missing authorization");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw userError || new Error("Unauthorized");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    if (profileError || profile?.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const studioId = String(body.studio_id || "");
    if (!studioId) throw new Error("Missing studio_id");

    if (body.action === "update") {
      const name = String(body.name || "").trim();
      const slug = String(body.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!name || !slug) throw new Error("Invalid project data");
      const { error } = await supabase
        .from("studios")
        .update({ name, slug })
        .eq("id", studioId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 8) throw new Error("Password must contain at least 8 characters");
      const { data: studio, error: studioError } = await supabase
        .from("studios")
        .select("user_id")
        .eq("id", studioId)
        .single();
      if (studioError) throw studioError;
      const { error: authError } = await supabase.auth.admin.updateUserById(studio.user_id, {
        password,
      });
      if (authError) throw authError;
      const { error: dbError } = await supabase
        .from("studios")
        .update({ admin_initial_password: password })
        .eq("id", studioId);
      if (dbError) throw dbError;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
