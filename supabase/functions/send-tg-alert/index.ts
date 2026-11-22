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
    const { class_id, client_name, client_phone } = await request.json();
    if (!class_id || !client_name || !client_phone) {
      return new Response(JSON.stringify({ error: "Missing booking data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("classes")
      .select("title,time_start,studio:studios(tg_bot_token,tg_chat_id,tg_verified_chat_id,tg_started_at)")
      .eq("id", class_id)
      .single();

    if (error) throw error;
    if (
      !data?.studio?.tg_bot_token
      || !data.studio.tg_chat_id
      || !data.studio.tg_started_at
      || data.studio.tg_verified_chat_id !== data.studio.tg_chat_id
    ) {
      return new Response(JSON.stringify({ ok: true, telegram: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text =
      `🌸 Новая заявка в Flow Studio!\n` +
      `Занятие: ${data.title}\n` +
      `Время: ${data.time_start}\n` +
      `Клиент: ${client_name}\n` +
      `Телефон: ${client_phone}`;

    const response = await fetch(
      `https://api.telegram.org/bot${data.studio.tg_bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: data.studio.tg_chat_id,
          text,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Telegram API returned ${response.status}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to send alert" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
