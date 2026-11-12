// Supabase Edge Function: notify-student-balance
// Runs from pg_cron every minute. Uses LESSON_REMINDERS_CRON_SECRET
// and ENABLE_TELEGRAM_LESSON_REMINDERS, shared with lesson reminders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("LESSON_REMINDERS_CRON_SECRET");
const deliveryEnabled = Deno.env.get("ENABLE_TELEGRAM_LESSON_REMINDERS") === "true";
const CHARGE_STATUSES = new Set(["conducted", "cancelled_charge"]);

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

async function fetchAll(query: any): Promise<any[]> {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
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

function classify(balance: number, price: number) {
  if (balance < 0) return { type: "debt", remaining: Math.floor(balance / price) };
  if (balance <= 0) return { type: "empty", remaining: 0 };
  const remaining = Math.floor((balance + 1e-9) / price);
  if (remaining < 1) return { type: "less_than_one", remaining };
  if (remaining <= 2) return { type: "low", remaining };
  return null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function notificationText(studentName: string, balance: number, price: number, state: any) {
  const money = formatMoney(balance);
  const remaining = state.remaining;
  if (state.type === "debt") {
    return `⚠️ Баланс ученика ${studentName}: задолженность ${money} BYN.\nBalance: ${money} BYN in debt.`;
  }
  if (state.type === "empty") {
    return `⚠️ У ученика ${studentName} закончились средства на занятия. Баланс: 0 BYN.\n${studentName} has run out of lesson funds. Balance: 0 BYN.`;
  }
  if (state.type === "less_than_one") {
    return `⚠️ У ученика ${studentName} осталось ${money} BYN — этого меньше чем на одно занятие стоимостью ${formatMoney(price)} BYN.\n${studentName} has ${money} BYN left — less than the cost of one lesson (${formatMoney(price)} BYN).`;
  }
  return `🔔 У ученика ${studentName} осталось ${money} BYN — хватит ещё на ${remaining} ${remaining === 1 ? "занятие" : "занятия"}.\n${studentName} has ${money} BYN left — enough for ${remaining} more lesson(s).`;
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
  const from = new Date(now - 4 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now + 1 * 86400000).toISOString().slice(0, 10);

  try {
    const candidates = await fetchAll(
      db.from("lessons")
        .select("id,student_id,student,date,time,timezone,duration,status,group_id,teacher_id")
        .in("status", ["conducted", "cancelled_charge"])
        .gte("date", from).lte("date", to)
        .order("date", { ascending: true })
    );

    let considered = 0;
    let sent = 0;
    let skipped = 0;
    let dryRun = 0;
    const errors: string[] = [];

    for (const lesson of candidates) {
      const end = zonedTimestamp(
        lesson.date, lesson.time || "11:00", lesson.timezone || "Europe/Minsk",
      ) + Math.max(1, Number(lesson.duration) || 60) * 60000;
      if (!Number.isFinite(end) || end > now - 5 * 60000) continue;

      let members: any[] = [];
      if (lesson.group_id) {
        const { data, error } = await db.from("lesson_members")
          .select("student_id,price,charged,attendance_status")
          .eq("lesson_id", lesson.id);
        if (error) { errors.push(`members:${lesson.id}`); continue; }
        members = (data ?? []).filter((m: any) =>
          m.student_id && m.charged !== false && m.attendance_status !== "cancelled_free"
        );
      } else if (lesson.student_id) {
        members = [{ student_id: lesson.student_id, price: lesson.price, charged: true }];
      }

      for (const member of members) {
        considered++;
        const { data: student, error: studentError } = await db.from("students")
          .select("id,name,price,telegram_chat_id,archived,teacher_id")
          .eq("id", member.student_id)
          .eq("teacher_id", lesson.teacher_id)
          .maybeSingle();
        if (studentError || !student || student.archived) {
          skipped++;
          if (studentError) errors.push(`student:${member.student_id}`);
          continue;
        }

        const price = Number(member.price ?? student.price ?? 0);
        if (!(price > 0)) { skipped++; continue; }

        const [studentPayments, studentLessons, groupMemberships] = await Promise.all([
          fetchAll(db.from("payments").select("amount").eq("student_id", student.id)),
          fetchAll(db.from("lessons").select("id,status,student_id,group_id,price").eq("teacher_id", lesson.teacher_id)),
          fetchAll(db.from("lesson_members").select("lesson_id,student_id,price,charged").eq("student_id", student.id)),
        ]);

        const income = studentPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        const memberByLesson = new Map(groupMemberships.map((m: any) => [String(m.lesson_id), m]));
        let expenses = 0;
        for (const item of studentLessons) {
          if (!CHARGE_STATUSES.has(item.status)) continue;
          if (!item.group_id && String(item.student_id || "") === String(student.id)) {
            expenses += Number(item.price || 0);
          } else if (item.group_id) {
            const m: any = memberByLesson.get(String(item.id));
            if (m && m.charged !== false) expenses += Number(m.price ?? student.price ?? 0);
          }
        }

        const balance = income - expenses;
        const state = classify(balance, price);
        if (!state) { skipped++; continue; }

        const recipients: Array<{ type: "student" | "teacher"; chatId: string | number }> = [];
        if (student.telegram_chat_id) {
          recipients.push({ type: "student", chatId: student.telegram_chat_id });
        }
        const { data: teacher, error: teacherError } = await db.from("profiles")
          .select("telegram_chat_id")
          .eq("id", lesson.teacher_id)
          .maybeSingle();
        if (teacherError) {
          errors.push(`teacher:${lesson.teacher_id}`);
        } else if (teacher?.telegram_chat_id) {
          recipients.push({ type: "teacher", chatId: teacher.telegram_chat_id });
        }
        if (!recipients.length) { skipped++; continue; }

        const message = notificationText(student.name || "Ученик", balance, price, state);
        for (const recipient of recipients) {
          if (!deliveryEnabled) {
            dryRun++;
            continue;
          }

          const { data: claim, error: claimError } = await db.from("telegram_balance_notifications")
            .insert({
              lesson_id: lesson.id,
              student_id: student.id,
              teacher_id: lesson.teacher_id,
              recipient_type: recipient.type,
              notification_type: state.type,
              balance,
              remaining_lessons: state.remaining,
            })
            .select("id")
            .maybeSingle();

          if (claimError?.code === "23505") continue;
          if (claimError || !claim) {
            errors.push(`dedupe:${lesson.id}:${student.id}:${recipient.type}`);
            continue;
          }

          try {
            await sendTelegram(recipient.chatId, message);
            sent++;
          } catch (error) {
            await db.from("telegram_balance_notifications").delete().eq("id", claim.id);
            errors.push(`send:${lesson.id}:${student.id}:${recipient.type}`);
            console.error("Balance notification delivery failed", error);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true, delivery_enabled: deliveryEnabled, considered, sent, dry_run: dryRun, skipped, errors,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Balance notification job failed", error);
    return new Response(JSON.stringify({ ok: false, error: "Balance notification job failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
