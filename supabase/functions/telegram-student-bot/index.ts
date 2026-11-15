// Supabase Edge Function: telegram-student-bot
// Required secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (provided by Supabase runtime).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const headers = { "Content-Type": "application/json" };

async function sendMessage(chatId: number, text: string) {
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    console.error("Telegram sendMessage failed", result);
    throw new Error("Telegram sendMessage failed");
  }
}

const welcome = "Hi! 👋 Welcome to ProfiProfit!\n\nI'm happy to be your English teacher! ❤️ I hope our lessons will be enjoyable, comfortable, and help you reach your goals.\n\nYour personal ProfiProfit page lets you:\n📅 View your lesson schedule and lesson history.\n💰 Track your balance, payments, and lesson charges.\n🔔 Receive reminders 1 hour and 10 minutes before lessons.\n📢 Stay up to date with schedule changes.\n\nI'll send you your personal account link separately.\n\nTo receive Telegram notifications, open the personal bot link I'll send you and press Start.\n\nIf you have any questions or need help, message me: <a href=\"https://t.me/tiana_wow\">@tiana_wow</a>.\n\nSee you in class! 😊\n\n———\n\nПривет! 👋 Добро пожаловать в ProfiProfit!\n\nЯ рада быть твоим преподавателем английского! ❤️ Надеюсь, наши занятия будут интересными, комфортными и помогут тебе достичь своих целей.\n\nВ личном кабинете ProfiProfit можно:\n📅 Смотреть расписание и историю занятий.\n💰 Отслеживать баланс, оплаты и списания за уроки.\n🔔 Получать напоминания за 1 час и за 10 минут до начала занятий.\n📢 Узнавать об изменениях в расписании.\n\nСсылку на личный кабинет я отправлю отдельно.\n\nЧтобы получать уведомления в Telegram, открой персональную ссылку на бота, которую я тебе отправлю, и нажми Start.\n\nЕсли возникнут вопросы или понадобится помощь, напиши мне: <a href=\"https://t.me/tiana_wow\">@tiana_wow</a>.\n\nДо встречи на занятиях! 😊"

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!botToken || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error("Missing required environment configuration");
    return new Response("Server configuration error", { status: 500 });
  }

  const suppliedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (suppliedSecret !== webhookSecret) return new Response("Unauthorized", { status: 401 });

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  if (!chatId || (!text.startsWith("/start") && text !== "/stop" && text !== "/disconnect")) return new Response("ok");

  const parts = text.split(/\s+/, 2);
  const payload = parts.length > 1 ? parts[1] : "";

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (text === "/stop" || text === "/disconnect") {
    const { data: linkedStudents } = await db.from("students")
      .select("id,name,teacher_id").eq("telegram_chat_id", chatId);
    if (linkedStudents?.length) {
      await db.from("students").update({ telegram_chat_id: null, telegram_connected_at: null })
        .eq("telegram_chat_id", chatId);
      for (const student of linkedStudents) {
        const { data: teacher } = await db.from("profiles").select("telegram_chat_id")
          .eq("id", student.teacher_id).maybeSingle();
        if (teacher?.telegram_chat_id) {
          await sendMessage(Number(teacher.telegram_chat_id),
            `⚠️ Telegram notifications disconnected\n${student.name} has disconnected their Telegram account. They will no longer receive lesson reminders or schedule updates via Telegram.\n\n⚠️ Ученик отключил Telegram\n${student.name} отключил(а) Telegram. Ученик больше не будет получать напоминания и уведомления об изменениях расписания.`);
        }
      }
      await sendMessage(chatId, "Telegram notifications have been disconnected. / Уведомления Telegram отключены.");
      return new Response("ok");
    }
    await sendMessage(chatId, "No linked student account was found. / Подключённый аккаунт ученика не найден.");
    return new Response("ok");
  }
  if (!payload) {
    await sendMessage(chatId, welcome);
    return new Response("ok");
  }
  if(payload.startsWith("teacher_")){
    const token=payload.slice("teacher_".length);
    const {data:teacher,error:teacherError}=await db.from("profiles").select("id,telegram_chat_id").eq("telegram_link_token",token).maybeSingle();
    if(teacherError){console.error("Teacher lookup failed",teacherError.message);await sendMessage(chatId,"Не удалось проверить ссылку. Попробуй позже.");return new Response("ok");}
    if(!teacher){await sendMessage(chatId,"Ссылка подключения недействительна. Создай новую в настройках ProfiProfit.");return new Response("ok");}
    if(teacher.telegram_chat_id&&Number(teacher.telegram_chat_id)!==Number(chatId)){await sendMessage(chatId,"К Telegram уже подключён другой аккаунт. Создай новую ссылку в настройках ProfiProfit, если нужно сменить аккаунт.");return new Response("ok");}
    const {error:updateTeacherError}=await db.from("profiles").update({telegram_chat_id:chatId,telegram_connected_at:new Date().toISOString()}).eq("id",teacher.id).eq("telegram_link_token",token);
    if(updateTeacherError){console.error("Teacher connection update failed",updateTeacherError.message);await sendMessage(chatId,"Не удалось подключить Telegram. Попробуй создать новую ссылку.");return new Response("ok");}
    await sendMessage(chatId,"Готово! ✅ Telegram преподавателя подключён к ProfiProfit. Здесь будут приходить уведомления, когда соответствующие функции будут включены.");
    return new Response("ok");
  }

  const { data: student, error } = await db
    .from("students")
    .select("id,name,telegram_chat_id")
    .eq("telegram_link_token", payload)
    .maybeSingle();

  if (error) {
    console.error("Student lookup failed", error.message);
    await sendMessage(chatId, "Не удалось проверить ссылку. Попробуй позже. / We couldn't verify this link. Please try again later.");
    return new Response("ok");
  }

  if (!student) {
    await sendMessage(chatId, "Эта ссылка недействительна. Попроси преподавателя прислать новую.\n\nThis link is invalid. Please ask your teacher for a new one.");
    return new Response("ok");
  }

  if (student.telegram_chat_id && Number(student.telegram_chat_id) !== Number(chatId)) {
    await sendMessage(chatId, "Этот ученик уже подключил другой Telegram-аккаунт. Попроси преподавателя помочь.\n\nThis student is already connected to another Telegram account. Please contact your teacher.");
    return new Response("ok");
  }

  const { error: updateError } = await db
    .from("students")
    .update({ telegram_chat_id: chatId, telegram_connected_at: new Date().toISOString() })
    .eq("id", student.id)
    .eq("telegram_link_token", payload);

  if (updateError) {
    console.error("Student connection update failed", updateError.message);
    await sendMessage(chatId, "All set, __NAME__! ✅ Telegram is connected.\n\nYou'll receive lesson reminders, schedule updates, and payment notifications according to your preferences.\n\nYour personal account: <a href=\"https://profiprofit.com/?student=__ID__\">Open ProfiProfit</a>\n\n———\n\nГотово, __NAME__! ✅ Telegram подключён.\n\nЗдесь будут приходить напоминания о занятиях, изменения расписания и уведомления о пополнении баланса — в соответствии с вашими настройками.\n\nЛичный кабинет: <a href=\"https://profiprofit.com/?student=__ID__\">Открыть ProfiProfit</a>".replaceAll("__NAME__", student.name).replaceAll("__ID__", String(student.id)));
  return new Response("ok");
});
