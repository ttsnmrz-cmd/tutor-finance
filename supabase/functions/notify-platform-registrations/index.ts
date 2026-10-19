// Supabase Edge Function: notify-platform-registrations
// Deploy with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
// and TELEGRAM_ADMIN_CHAT_ID configured as Edge Function secrets.
// Schedule this function every minute using Supabase Cron / pg_net.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = expected;
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  if (!supabaseUrl || !botToken || !chatId) {
    return new Response(JSON.stringify({ error: "Missing required function secrets" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: events, error } = await db
    .from("platform_registration_events")
    .select("user_id,email,registered_at")
    .is("telegram_notified_at", null)
    .order("registered_at", { ascending: true })
    .limit(20);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const event of events || []) {
    const when = new Date(event.registered_at).toLocaleString("ru-RU", { timeZone: "Europe/Minsk" });
    const message = [
      "🆕 Новая регистрация ProfiProfit",
      `Email: ${event.email || "не указан"}`,
      `Дата: ${when}`,
      `ID: ${event.user_id}`,
    ].join("\n");

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const telegramResult = await response.json().catch(() => ({}));
    if (!response.ok || !telegramResult.ok) {
      return new Response(JSON.stringify({ error: "Telegram send failed", details: telegramResult }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await db
      .from("platform_registration_events")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("user_id", event.user_id);
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
