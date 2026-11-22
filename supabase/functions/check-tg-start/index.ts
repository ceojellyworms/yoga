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
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw userError || new Error("Unauthorized");

    const { studio_id } = await request.json();
    if (!studio_id) throw new Error("Missing studio_id");

    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .select("id,tg_bot_token,tg_chat_id,user_id")
      .eq("id", studio_id)
      .single();
    if (studioError) throw studioError;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    const isSuperadmin = profile?.role === "superadmin";
    if (!isSuperadmin && studio.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!studio.tg_bot_token || !studio.tg_chat_id) {
      return new Response(JSON.stringify({ verified: false, reason: "missing_config" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${studio.tg_bot_token}/getUpdates`,
    );
    if (!response.ok) throw new Error(`Telegram API returned ${response.status}`);
    const updates = await response.json();
    const started = (updates.result || []).some((update: any) =>
      String(update?.message?.chat?.id) === String(studio.tg_chat_id)
      && String(update?.message?.text || "").trim().startsWith("/start")
    );

    if (started) {
      const { error: updateError } = await supabase
        .from("studios")
        .update({
          tg_verified_chat_id: studio.tg_chat_id,
          tg_started_at: new Date().toISOString(),
        })
        .eq("id", studio_id);
      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ verified: started }), {
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
