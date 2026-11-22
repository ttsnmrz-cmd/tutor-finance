# ProfiProfit platform monitoring setup

This feature adds:
- a database event for each new Supabase Auth registration;
- Telegram notifications for new registrations;
- an admin-only dashboard with registration date, active student count, lesson count, and last use.

## 1. Apply the database migration

In Supabase Dashboard → SQL Editor, run the full contents of `supabase/migrations/008_platform_monitoring.sql`.

The migration creates protected tables and two RPCs. It does not change the existing teacher data or teacher RLS policies.

## 2. Grant your account admin access

First sign in to ProfiProfit at least once so your account exists. In Supabase Dashboard → SQL Editor, run the following query with the email address you use for the owner account:

```sql
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_OWNER_EMAIL')
on conflict (user_id) do nothing;
```

Replace `YOUR_OWNER_EMAIL` with your real account email. Confirm that exactly one row was added. Do not expose this table to anon or other authenticated users.

After that, sign out and sign in again. The **Админ** tab should appear for your account only.

## 3. Create the Telegram bot

1. In Telegram, open the verified `@BotFather` account and create a bot with `/newbot`.
2. Copy the bot token and keep it private.
3. Open the new bot from your own Telegram account and press **Start**.
4. Obtain your numeric Telegram chat ID using the Telegram Bot API `getUpdates` endpoint after sending a message to the bot. Do not paste the bot token into GitHub, the frontend, or a public chat.

## 4. Deploy the Edge Function and configure secrets

Deploy `supabase/functions/notify-platform-registrations/index.ts` using the Supabase CLI linked to the correct project:

```bash
supabase functions deploy notify-platform-registrations --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN TELEGRAM_ADMIN_CHAT_ID=YOUR_CHAT_ID SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Use your real values locally in the terminal, not in this repository. The service-role key is highly privileged and must never be put in `js/config.js`, HTML, or GitHub Actions logs.

## 5. Schedule the function

Configure a Supabase Cron job to invoke `notify-platform-registrations` every minute. The function is deployed with JWT verification disabled because it validates the exact service-role secret itself. The scheduled request must include this header:

```
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json
```

Use Supabase Vault / the dashboard's secret configuration for the key; do not hardcode it in a committed SQL file. The function checks pending registration events, sends each message to your Telegram chat, and marks the event as notified. If Telegram rejects a message, the event remains pending so the next run can retry.

## 6. Test

1. Run the function once manually from the Supabase dashboard and verify that it returns `{"ok":true,"sent":0}` when there are no pending events.
2. Register a separate test account using an email you control.
3. Verify that a Telegram message arrives and that the **Админ** tab shows the new account.
4. Open the test account, add a student and create a lesson; refresh the owner dashboard and verify that counts and last-use time update.

## Notes

- Registration notifications start for accounts created after the migration is applied. Existing accounts remain visible in the dashboard but do not generate retroactive Telegram messages.
- The activity timestamp is updated on login and when the app becomes visible again; it is not a full analytics or session-duration tracker.
- Student and lesson counts rely on the existing `teacher_id` ownership columns being correctly populated.
