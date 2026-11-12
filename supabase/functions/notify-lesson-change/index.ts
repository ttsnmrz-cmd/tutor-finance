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
  const event = body?.event;
  const isDeleted = event === "deleted";
  const deletedLessons = Array.isArray(body?.deleted_lessons) ? body.deleted_lessons.slice(0, 100) : [];
  const ids = Array.isArray(body?.lesson_ids) ? [...new Set(body.lesson_ids.map(String))].slice(0, 100) : [];
  if (!["created", "updated", "cancelled", "deleted"].includes(event) || (isDeleted ? !deletedLessons.length : !ids.length)) {
    return jsonResponse({ error: "Invalid lesson payload or event" }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const results = [];
  const items = isDeleted
    ? deletedLessons.map((x: any) => ({ id: String(x?.lesson_id || ""), date: String(x?.date || ""), time: String(x?.time || ""), student_ids: Array.isArray(x?.student_ids) ? [...new Set(x.student_ids.map(String))] : [] }))
    : ids.map((id: string) => ({ id }));

  for (const item of items) {
    let lesson: any;
    let recipients: any[] = [];
    if (isDeleted) {
      if (!item.id || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.time || !item.student_ids.length) {
        results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: 1, skipped: "invalid_deleted_snapshot" });
        continue;
      }
      const { data, error } = await db.from("students").select("id,name,telegram_chat_id,telegram_notify_changes")
        .eq("teacher_id", user.id).in("id", item.student_ids);
      if (error) {
        results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: item.student_ids.length, skipped: "students_lookup_failed" });
        continue;
      }
      recipients = data || [];
      lesson = { id: item.id, date: item.date, time: item.time };
    } else {
      const { data, error } = await db.from("lessons").select("id,student,student_id,group_id,date,time,timezone,teacher_id,status")
        .eq("id", item.id).eq("teacher_id", user.id).maybeSingle();
      if (error) {
        console.error("Lesson lookup failed", item.id, error);
        results.push({ lesson_id: item.id, sent: 0, failed: 1, skipped_count: 0, error: "lesson_lookup_failed" });
        continue;
      }
      if (!data) {
        results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: 1, skipped: "lesson_not_found" });
        continue;
      }
      lesson = data;
      if (lesson.group_id) {
        const { data: members, error: membersError } = await db.from("lesson_members").select("student_id").eq("lesson_id", lesson.id).eq("teacher_id", user.id);
        if (membersError) {
          console.error("Lesson members lookup failed", lesson.id, membersError);
          results.push({ lesson_id: item.id, sent: 0, failed: 1, skipped_count: 0, error: "lesson_members_lookup_failed" });
          continue;
        }
        const memberIds = [...new Set((members || []).map((m: any) => String(m.student_id)).filter(Boolean))];
        if (!memberIds.length) {
          results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: 1, skipped: "no_lesson_members" });
          continue;
        }
        const { data: students, error: studentsError } = await db.from("students").select("id,name,telegram_chat_id,telegram_notify_changes")
          .eq("teacher_id", user.id).in("id", memberIds);
        if (studentsError) {
          console.error("Group students lookup failed", lesson.id, studentsError);
          results.push({ lesson_id: item.id, sent: 0, failed: 1, skipped_count: 0, error: "students_lookup_failed" });
          continue;
        }
        recipients = students || [];
      } else if (lesson.student_id) {
        const { data: students, error: studentsError } = await db.from("students").select("id,name,telegram_chat_id,telegram_notify_changes")
          .eq("teacher_id", user.id).eq("id", lesson.student_id);
        if (studentsError) {
          console.error("Student lookup failed", lesson.id, studentsError);
          results.push({ lesson_id: item.id, sent: 0, failed: 1, skipped_count: 0, error: "students_lookup_failed" });
          continue;
        }
        recipients = students || [];
      } else {
        results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: 1, skipped: "lesson_has_no_student" });
        continue;
      }
      if (!recipients.length) {
        results.push({ lesson_id: item.id, sent: 0, failed: 0, skipped_count: 1, skipped: "no_students_found" });
        continue;
      }
    }

    const dateTime = formatDate(lesson.date, lesson.time);
    let message = "";
    if (event === "created") message = `Здравствуйте! 👋\nВ расписании появилось новое занятие: ${dateTime}.\nДо встречи!`;
    else if (event === "cancelled") message = `Здравствуйте!\nЗанятие ${dateTime} отменяется. О времени следующего занятия сообщу дополнительно.`;
    else if (event === "deleted") message = `Здравствуйте!\nЗанятие ${dateTime} удалено из расписания.`;
    else message = `Здравствуйте! 👋\nВ расписании изменилось занятие: ${dateTime}.\nПодробности можно посмотреть в личном кабинете.`;

    let sent = 0;
    let failed = 0;
    let skipped_count = 0;
    for (const student of recipients) {
      if (!student.telegram_chat_id || student.telegram_notify_changes === false) { skipped_count++; continue; }
      const cabinet = `https://profiprofit.com/?student=${student.id}`;
      try {
        await send(student.telegram_chat_id, `${message}\n\nЛичный кабинет: ${cabinet}`);
        sent++;
      } catch (e) {
        failed++;
        console.error("Notification failed", lesson.id, student.id, e);
      }
    }
    results.push({ lesson_id: lesson.id, sent, failed, skipped_count, recipients: recipients.length });
  }
  return jsonResponse({ ok: true, results });
});
