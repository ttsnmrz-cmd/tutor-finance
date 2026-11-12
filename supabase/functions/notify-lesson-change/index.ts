// Supabase Edge Function: notify-lesson-change
// Sends schedule-change notifications only after an authenticated teacher explicitly confirms.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

function formatDate(date: string, time: string) {
  // The lesson date and time are already stored in the teacher's local timezone.
  // Formatting them as UTC and converting again would shift the displayed time.
  const [year, month, day] = date.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
  return `${day} ${monthName} в ${time.slice(0, 5)}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function send(chatId: string | number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram sendMessage failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !botToken) return jsonResponse({ error: "Server configuration error" }, 500);

  const authorization = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.lesson_ids) ? [...new Set(body.lesson_ids.map(String))].slice(0, 100) : [];
  const event = body?.event;
  if (!ids.length || !["created", "updated", "cancelled"].includes(event)) {
    return jsonResponse({ error: "Invalid lesson_ids or event" }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const results = [];
  for (const id of ids) {
    const { data: lesson, error } = await db.from("lessons")
      .select("id,student,group_id,date,time,timezone,teacher_id,status")
      .eq("id", id).eq("teacher_id", user.id).maybeSingle();
    if (error || !lesson) { results.push({ lesson_id: id, sent: 0, skipped: "lesson_not_found" }); continue; }

    let recipients: any[] = [];
    if (lesson.group_id) {
      const { data: members } = await db.from("lesson_members").select("student_id").eq("lesson_id", lesson.id).eq("teacher_id", user.id);
      const memberIds = (members || []).map((m: any) => m.student_id);
      if (memberIds.length) {
        const { data } = await db.from("students")
          .select("id,name,telegram_chat_id,telegram_notify_changes,telegram_link_token")
          .eq("teacher_id", user.id).in("id", memberIds);
        recipients = data || [];
      }
    } else {
      const { data } = await db.from("students")
        .select("id,name,telegram_chat_id,telegram_notify_changes,telegram_link_token")
        .eq("teacher_id", user.id).eq("name", lesson.student);
      // Name is the legacy individual-lesson relation. Avoid sending to the wrong person if names are duplicated.
      recipients = data?.length === 1 ? data : [];
    }

    const dateTime = formatDate(lesson.date, lesson.time);
    let message = "";
    if (event === "created") message = `Здравствуйте! 👋\nВ расписании появилось новое занятие: ${dateTime}.\nДо встречи!`;
    else if (event === "cancelled") message = `Здравствуйте!\nЗанятие ${dateTime} отменяется. О времени следующего занятия сообщу дополнительно.`;
    else message = `Здравствуйте! 👋\nВ расписании изменилось занятие: ${dateTime}.\nПодробности можно посмотреть в личном кабинете.`;

    let sent = 0;
    for (const student of recipients) {
      if (!student.telegram_chat_id || student.telegram_notify_changes === false) continue;
      const cabinet = `https://profiprofit.com/?student=${student.id}`;
      try {
        await send(student.telegram_chat_id, `${message}\n\nЛичный кабинет: ${cabinet}`);
        sent++;
      } catch (e) {
        console.error("Notification failed", lesson.id, student.id, e);
      }
    }
    results.push({ lesson_id: id, sent, recipients: recipients.length });
  }
  return jsonResponse({ ok: true, results });
});
