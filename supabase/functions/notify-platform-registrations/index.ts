// Supabase Edge Function: notify-platform-registrations
// Required Edge Function secrets:
// TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, PLATFORM_CRON_SECRET.
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the runtime.
// Invoke with: Authorization: Bearer <PLATFORM_CRON_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("PLATFORM_CRON_SECRET");
  const auth = req.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  if (!supabaseUrl || !serviceKey || !botToken || !chatId) {
    return new Response(JSON.stringify({ error: "Missing required function environment configuration" }), {
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
