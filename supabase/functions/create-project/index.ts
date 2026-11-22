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
    const isSuperadmin =
      profile?.role === "superadmin"
      || String(userData.user.email || "").toLowerCase() === "ceojellyworms@gmail.com";
    if (profileError && !isSuperadmin) {
      console.error(profileError);
    }
    if (!isSuperadmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!name || !slug) {
      return new Response(JSON.stringify({ error: "Invalid project data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const random = () => {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    const adminLogin = `club-${random().slice(0, 10)}`;
    const adminPassword = `Ps-${random()}-${random().slice(0, 8)}`;
    const adminEmail = `${adminLogin}@flow-admin.local`;

    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError || new Error("Failed to create admin");
    const adminUserId = adminData.user.id;

    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .insert({
        user_id: adminUserId,
        name,
        slug,
        admin_login: adminLogin,
        admin_email: adminEmail,
        admin_initial_password: adminPassword,
      })
      .select("*")
      .single();
    if (studioError) throw studioError;

    const { error: projectAdminError } = await supabase
      .from("project_admins")
      .insert({ studio_id: studio.id, user_id: adminUserId });
    if (projectAdminError) throw projectAdminError;

    return new Response(JSON.stringify({
      ok: true,
      url: `${String(body.site_url || "").replace(/\/$/, "")}/${slug}`,
      studio,
      credentials: { login: adminLogin, password: adminPassword },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
