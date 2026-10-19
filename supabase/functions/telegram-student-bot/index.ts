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

const welcome = `Привет! 👋 Добро пожаловать в ProfiProfit!

Я очень рада, что ты решил улучшить свой английский и выбрал меня в качестве своего преподавателя! ❤️ Надеюсь, наши занятия будут интересными, комфортными и помогут тебе достичь твоих целей.

Чтобы тебе было удобнее организовывать занятия, я подготовила для тебя личную страницу в ProfiProfit. Там ты сможешь:
📅 Смотреть расписание и историю занятий.
💰 Отслеживать баланс, оплаты и списания за уроки.
🔔 Получать напоминания о предстоящих занятиях — за 1 час и за 10 минут до начала.
📢 Узнавать об изменениях в расписании, например о переносах и отменах занятий.

Я отправлю тебе ссылку на твою личную страницу отдельно.

А ещё ты можешь подключить уведомления в Telegram, чтобы ничего не пропустить. Для этого открой персональную ссылку на бота, которую я тебе отправлю, и нажми Start.

Если возникнут вопросы или что-то не получится, смело пиши мне: <a href="https://t.me/tiana_wow">@tiana_wow</a>. Я помогу! 😊

До встречи на занятиях! 🚀

———

Hi! 👋 Welcome to ProfiProfit!

I'm really happy that you've decided to improve your English and chosen me as your teacher! ❤️ I hope our lessons will be enjoyable, comfortable, and help you achieve your goals.

To make managing your lessons easier, I've prepared your personal page on ProfiProfit. There, you can:
📅 View your lesson schedule and lesson history.
💰 Keep track of your balance, payments, and lesson charges.
🔔 Get reminders about upcoming lessons — 1 hour and 10 minutes before they start.
📢 Stay informed about schedule changes, such as rescheduled or cancelled lessons.

I'll send you the link to your personal page separately.

You can also enable Telegram notifications so you don't miss anything. Just open the personal bot link I'll send you and press Start.

If you have any questions or need help, feel free to message me: <a href="https://t.me/tiana_wow">@tiana_wow</a>. I'll be happy to help! 😊

See you in class! 🚀`;

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
  if (!chatId || !text.startsWith("/start")) return new Response("ok");

  const parts = text.split(/\s+/, 2);
  const payload = parts.length > 1 ? parts[1] : "";

  if (!payload) {
    await sendMessage(chatId, welcome);
    return new Response("ok");
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
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
    await sendMessage(chatId, "Не удалось подключить Telegram. Напиши преподавателю: @tiana_wow\n\nCouldn't connect Telegram. Please message your teacher: @tiana_wow");
    return new Response("ok");
  }

  await sendMessage(chatId, `Готово, ${student.name}! ✅ Telegram подключён. Ты получишь напоминания за 1 час и за 10 минут до занятия.\n\nAll set, ${student.name}! ✅ Telegram is connected. You'll get reminders 1 hour and 10 minutes before each lesson.\n\nЕсли возникнут проблемы, напиши <a href="https://t.me/tiana_wow">@tiana_wow</a>.\nIf you need help, message <a href="https://t.me/tiana_wow">@tiana_wow</a>.`);
  return new Response("ok");
});
