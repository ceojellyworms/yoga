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
    const { login, password } = await request.json();
    if (!login || !password) {
      return new Response(JSON.stringify({ error: "Введите логин и пароль" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: studio, error } = await service
      .from("studios")
      .select("admin_login,admin_email")
      .eq("admin_login", String(login).trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!studio?.admin_email) {
      return new Response(JSON.stringify({ error: "Неверный логин или пароль" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicKey = request.headers.get("apikey");
    if (!publicKey) throw new Error("Missing publishable key");
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, publicKey);
    const { data, error: signInError } = await auth.auth.signInWithPassword({
      email: studio.admin_email,
      password,
    });
    if (signInError) {
      return new Response(JSON.stringify({ error: "Неверный логин или пароль" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Не удалось войти" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
