// Supabase Edge Function: notify-lesson-reminders
// Required secrets:
// TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// LESSON_REMINDERS_CRON_SECRET.
// Safe by default: messages are logged but NOT sent unless
// ENABLE_TELEGRAM_LESSON_REMINDERS is exactly "true".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("LESSON_REMINDERS_CRON_SECRET");
const deliveryEnabled = Deno.env.get("ENABLE_TELEGRAM_LESSON_REMINDERS") === "true";

function zonedTimestamp(date: string, time: string, timezone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).replace(".", ":").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return NaN;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const represented = Date.UTC(
      Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute),
    );
    const correction = target - represented;
    guess += correction;
    if (correction === 0) break;
  }
  return guess;
}

function displayTime(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(timestamp));
}

function reminderText(type: "1h" | "10m", timestamp: number, timezone: string): string {
  if (type === "10m") return "Hi!\nНаше занятие начнётся через 10 минут. До встречи!";
  const time = displayTime(timestamp, timezone);
  return `Hi! 👋\nНапоминаю, что сегодня в ${time} состоится наше занятие.\nДо встречи!`;
}

function teacherReminderText(type: "1h" | "10m", studentNames: string[]): string {
  const names = [...new Set(studentNames.filter(Boolean))];
  const subject = names.length === 1
    ? `занятие с учеником ${names[0]}`
    : names.length > 1
      ? `занятие с учениками ${names.join(", ")}`
      : "занятие";
  const capitalizedSubject = subject[0].toUpperCase() + subject.slice(1);
  if (type === "10m") {
    return `Hi!\n${capitalizedSubject} должно начаться через 10 минут.`;
  }
  return `Hi!\n${capitalizedSubject} запланировано через 1 час.`;
}

async function sendTelegram(chatId: string | number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram sendMessage failed");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabaseUrl || !serviceKey || !cronSecret || !botToken) {
    return new Response("Server configuration error", { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = Date.now();
  const from = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now + 3 * 86400000).toISOString().slice(0, 10);

  const { data: lessons, error: lessonsError } = await db
    .from("lessons")
    .select("id,student,student_id,date,time,timezone,status,group_id,teacher_id")
    .eq("status", "pending")
    .gte("date", from)
    .lte("date", to);

  if (lessonsError) {
    console.error("Lesson query failed", lessonsError.message);
    return new Response("Lesson query failed", { status: 500 });
  }

  let considered = 0;
  let sent = 0;
  let dryRun = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lesson of lessons ?? []) {
    const timezone = lesson.timezone || "Europe/Minsk";
    let start: number;
    try {
      start = zonedTimestamp(lesson.date, lesson.time || "11:00", timezone);
    } catch {
      skipped++;
      continue;
    }
    if (!Number.isFinite(start)) { skipped++; continue; }

    const minutes = (start - now) / 60000;
    const type = minutes >= 59 && minutes <= 60 ? "1h"
      : minutes >= 9 && minutes <= 10 ? "10m" : null;
    if (!type) continue;
    considered++;

    let recipients: any[] = [];
    if (lesson.group_id) {
      const { data, error } = await db
        .from("lesson_members")
        .select("student_id")
        .eq("lesson_id", lesson.id);
      if (error) { errors.push(`members:${lesson.id}`); continue; }
      const ids = (data ?? []).map((m: any) => m.student_id);
      if (!ids.length) continue;
      const { data: students, error: studentsError } = await db
        .from("students")
        .select("id,name,telegram_chat_id,telegram_notify_1h,telegram_notify_10m,timezone,archived")
        .in("id", ids)
        .eq("teacher_id", lesson.teacher_id)
        .eq("archived", false);
      if (studentsError) { errors.push(`students:${lesson.id}`); continue; }
      recipients = students ?? [];
    } else {
      if (!lesson.student_id) {
        // Ambiguous legacy records are intentionally not matched by name.
        // Keep the teacher reminder, but do not guess a student recipient.
        skipped++;
      } else {
        const { data, error } = await db
          .from("students")
          .select("id,name,telegram_chat_id,telegram_notify_1h,telegram_notify_10m,timezone,archived")
          .eq("id", lesson.student_id)
          .eq("teacher_id", lesson.teacher_id)
          .eq("archived", false);
        if (error) { errors.push(`students:${lesson.id}`); continue; }
        recipients = data ?? [];
      }
    }

    // Teacher receives one reminder per lesson, independently of student preferences.
    const { data: teacherProfile, error: teacherError } = await db
      .from("profiles")
      .select("telegram_chat_id,timezone")
      .eq("id", lesson.teacher_id)
      .maybeSingle();
    if (teacherError) {
      errors.push(`teacher-profile:${lesson.id}`);
    } else if (teacherProfile?.telegram_chat_id) {
      const teacherText = teacherReminderText(type, (recipients ?? []).map((student: any) => student.name));
      if (!deliveryEnabled) {
        dryRun++;
        console.log("DRY RUN teacher reminder", { lesson_id: lesson.id, type, text: teacherText });
      } else {
        const { data: claim, error: claimError } = await db
          .from("telegram_teacher_lesson_reminders")
          .upsert({ lesson_id: lesson.id, teacher_id: lesson.teacher_id, reminder_type: type },
            { onConflict: "lesson_id,reminder_type", ignoreDuplicates: true })
          .select("id");
        if (claimError) {
          errors.push(`teacher-dedupe:${lesson.id}`);
        } else if (claim?.length) {
          try {
            await sendTelegram(teacherProfile.telegram_chat_id, teacherText);
            sent++;
          } catch (error) {
            await db.from("telegram_teacher_lesson_reminders")
              .delete().eq("lesson_id", lesson.id).eq("reminder_type", type);
            errors.push(`teacher-send:${lesson.id}`);
            console.error("Teacher Telegram delivery failed", error);
          }
        }
      }
    }

    for (const student of recipients) {
      const enabled = type === "1h" ? student.telegram_notify_1h : student.telegram_notify_10m;
      if (!enabled || !student.telegram_chat_id) { skipped++; continue; }

      const text = reminderText(type, start, student.timezone || timezone);
      if (!deliveryEnabled) {
        dryRun++;
        console.log("DRY RUN reminder", { lesson_id: lesson.id, student_id: student.id, type, text });
        continue;
      }

      const { data: claim, error: claimError } = await db
        .from("telegram_lesson_reminders")
        .upsert({
          lesson_id: lesson.id,
          student_id: student.id,
          teacher_id: lesson.teacher_id,
          reminder_type: type,
        }, { onConflict: "lesson_id,student_id,reminder_type", ignoreDuplicates: true })
        .select("id");

      if (claimError) { errors.push(`dedupe:${lesson.id}:${student.id}`); continue; }
      if (!claim?.length) continue;

      try {
        await sendTelegram(student.telegram_chat_id, text);
        sent++;
      } catch (error) {
        await db.from("telegram_lesson_reminders")
          .delete()
          .eq("lesson_id", lesson.id)
          .eq("student_id", student.id)
          .eq("reminder_type", type);
        errors.push(`send:${lesson.id}:${student.id}`);
        console.error("Telegram delivery failed", error);
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true, delivery_enabled: deliveryEnabled, considered, sent, dry_run: dryRun, skipped,
    errors,
  }), { headers: { "Content-Type": "application/json" } });
});
