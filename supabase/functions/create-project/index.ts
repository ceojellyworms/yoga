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
    const directionMode = ["yoga", "dance", "both"].includes(String(body.direction_mode))
      ? String(body.direction_mode)
      : "both";
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
    const adminEmail = `${adminLogin}@flowstudio-admin.com`;

    const { data: existingSlug } = await supabase
      .from("studios")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingSlug) {
      return new Response(JSON.stringify({ error: "Этот адрес проекта уже занят" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (adminError || !adminData.user) {
      const detail =
        adminError && "message" in adminError
          ? String(adminError.message)
          : "Failed to create admin";
      throw new Error(`Auth create failed: ${detail}`);
    }
    const adminUserId = adminData.user.id;

    let studio;
    try {
      const { data: createdStudio, error: studioError } = await supabase
        .from("studios")
        .insert({
          user_id: adminUserId,
          name,
          slug,
          direction_mode: directionMode,
          admin_login: adminLogin,
          admin_email: adminEmail,
          admin_initial_password: adminPassword,
        })
        .select("*")
        .single();
      if (studioError) throw studioError;
      studio = createdStudio;

      const { error: projectAdminError } = await supabase
        .from("project_admins")
        .insert({ studio_id: studio.id, user_id: adminUserId });
      if (projectAdminError) throw projectAdminError;
    } catch (error) {
      if (studio?.id) {
        await supabase.from("studios").delete().eq("id", studio.id);
      }
      await supabase.auth.admin.deleteUser(adminUserId);
      throw error;
    }

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
    let message = "Failed";
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      message = String(record.message || record.error || JSON.stringify(error));
    } else {
      message = String(error);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
