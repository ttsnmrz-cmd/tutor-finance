BEGIN;
CREATE OR REPLACE FUNCTION public.auto_complete_past_lessons()
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
 UPDATE public.lessons
 SET status = 'conducted'
 WHERE status = 'pending'
   -- Preserve two historical records pending manual verification.
   AND id NOT IN (448, 449)
   AND time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   AND timezone IN (SELECT name FROM pg_catalog.pg_timezone_names)
   AND ((date + time::time) AT TIME ZONE timezone
        + make_interval(mins => duration + 1)) <= now();
$$;
REVOKE ALL ON FUNCTION public.auto_complete_past_lessons()
FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('auto-complete-lessons-every-minute', '* * * * *',
 'SELECT public.auto_complete_past_lessons();');
SELECT public.auto_complete_past_lessons();
COMMIT;
