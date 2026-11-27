// Supabase Edge Function: notify-payment
// Called once after a teacher successfully records a payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function send(chatId: string | number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error("Telegram sendMessage failed");
}
function money(n: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !botToken) return json({ error: "Server configuration error" }, 500);

  const authorization = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const paymentId = String(body?.payment_id || "");
  if (!paymentId) return json({ error: "payment_id is required" }, 400);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: payment, error: paymentError } = await db.from("payments")
    .select("id,student_id,student,amount,teacher_id")
    .eq("id", paymentId).eq("teacher_id", user.id).maybeSingle();
  if (paymentError || !payment) return json({ error: "Payment not found" }, 404);

  const { data: student, error: studentError } = await db.from("students")
    .select("id,name,price,telegram_chat_id,telegram_notify_payments,archived")
    .eq("id", payment.student_id).eq("teacher_id", user.id).maybeSingle();
  if (studentError || !student || student.archived) return json({ error: "Student not found" }, 404);

  const { data: teacher, error: teacherError } = await db.from("profiles")
    .select("telegram_chat_id").eq("id", user.id).maybeSingle();
  if (teacherError) return json({ error: "Teacher lookup failed" }, 500);

  const [paymentsResult, lessonsResult, membershipsResult] = await Promise.all([
    db.from("payments").select("amount").eq("student_id", student.id).eq("teacher_id", user.id),
    db.from("lessons").select("id,status,student_id,group_id,price").eq("teacher_id", user.id),
    db.from("lesson_members").select("lesson_id,price,charged").eq("student_id", student.id).eq("teacher_id", user.id),
  ]);
  if (paymentsResult.error || lessonsResult.error || membershipsResult.error) return json({ error: "Balance calculation failed" }, 500);

  const income = (paymentsResult.data || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const memberMap = new Map((membershipsResult.data || []).map((m: any) => [String(m.lesson_id), m]));
  let expenses = 0;
  for (const lesson of lessonsResult.data || []) {
    if (!["conducted", "cancelled_charge"].includes(lesson.status)) continue;
    if (!lesson.group_id && String(lesson.student_id || "") === String(student.id)) {
      expenses += Number(lesson.price || 0);
    } else if (lesson.group_id) {
      const m: any = memberMap.get(String(lesson.id));
      if (m && m.charged !== false) expenses += Number(m.price ?? student.price ?? 0);
    }
  }
  const balance = income - expenses;
  const lessonPrice = Number(student.price || 0);
  const wholeLessons = lessonPrice > 0 ? Math.max(0, Math.floor((balance + 1e-9) / lessonPrice)) : 0;
  const remainder = lessonPrice > 0 ? Math.max(0, balance - wholeLessons * lessonPrice) : balance;

  const recipients: Array<{ type: "student" | "teacher"; chat: string | number; message: string }> = [];
  if (student.telegram_chat_id && student.telegram_notify_payments === true) {
    const countText = wholeLessons === 1 ? "1 занятие" : wholeLessons >= 2 && wholeLessons <= 4 ? `${wholeLessons} занятия` : `${wholeLessons} занятий`;
    const remainderText = remainder > 0 ? ` и ещё ${money(remainder)} BYN остатка` : "";
    recipients.push({
      type: "student", chat: student.telegram_chat_id,
      message: `💚 Thank you for topping up your balance!\n\nWe received your payment of ${money(Number(payment.amount))} BYN.\nYour current balance covers ${wholeLessons} lesson(s)${remainder > 0 ? ` with ${money(remainder)} BYN remaining` : ""}.\n\nSee you in class! 😊\n\n💚 Спасибо за пополнение баланса!\n\nНа ваш счёт поступило ${money(Number(payment.amount))} BYN.\nТеперь средств хватит на ${countText}${remainderText} по текущей стоимости.\n\nДо встречи на занятии! 😊\n\nYour personal account / Ваш личный кабинет: https://profiprofit.com/?student=${student.id}`,
    });
  }
  if (teacher?.telegram_chat_id) {
    recipients.push({
      type: "teacher", chat: teacher.telegram_chat_id,
      message: `💰 ${student.name || payment.student || "Student"} topped up their balance by ${money(Number(payment.amount))} BYN.\nNew balance: ${money(balance)} BYN.\nCovers ${wholeLessons} lesson(s)${remainder > 0 ? ` with ${money(remainder)} BYN remaining` : ""}.\n\n💰 ${student.name || payment.student || "Ученик"} пополнил(а) баланс на ${money(Number(payment.amount))} BYN.\nНовый баланс: ${money(balance)} BYN.\nХватит на ${wholeLessons} ${wholeLessons === 1 ? "занятие" : "занятий"}${remainder > 0 ? ` и ${money(remainder)} BYN остатка` : ""}.\n\nStudent account / Кабинет ученика: https://profiprofit.com/?student=${student.id}`,
    });
  }

  let sent = 0, skipped = 0;
  const errors: string[] = [];
  for (const recipient of recipients) {
    const { data: claim, error: claimError } = await db.from("telegram_payment_notifications")
      .insert({ payment_id: String(payment.id), student_id: student.id, teacher_id: user.id, recipient_type: recipient.type, delivery_status: "claimed" })
      .select("id").maybeSingle();
    if (claimError?.code === "23505") {
      skipped++;
      const previous = await db.from("telegram_payment_notifications").select("delivery_status")
        .eq("payment_id", String(payment.id)).eq("recipient_type", recipient.type).maybeSingle();
      if (previous.error || previous.data?.delivery_status !== "sent") {
        errors.push(`delivery_unconfirmed:${recipient.type}`);
      }
      continue;
    }
    if (claimError || !claim) { errors.push(`claim:${recipient.type}`); continue; }
    let accepted = false;
    try {
      await send(recipient.chat, recipient.message);
      accepted = true;
    } catch {
      errors.push(`delivery_unconfirmed:${recipient.type}`);
      console.error("Payment notification delivery unconfirmed; claim retained");
    }
    try {
      const status = accepted ? "sent" : "unknown";
      const result = await db.from("telegram_payment_notifications")
        .update({ delivery_status: status, delivered_at: accepted ? new Date().toISOString() : null })
        .eq("id", claim.id).select("delivery_status").maybeSingle();
      if (result.error || result.data?.delivery_status !== status) throw new Error("Status write failed");
      if (accepted) sent++;
    } catch {
      errors.push(`status_write:${recipient.type}`);
      console.error("Payment notification status was not confirmed; claim retained");
    }
  }
  return json({ ok: true, sent, skipped, errors, balance, lessons_covered: wholeLessons });
});
