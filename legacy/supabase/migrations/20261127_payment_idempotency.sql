BEGIN;

-- Nullable for historical rows: no backfill, deduplication or balance changes.
ALTER TABLE public.payments ADD COLUMN operation_id uuid;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_operation_id_key UNIQUE (operation_id);
-- Old clients remain compatible; updated clients must supply a stable UUID.
ALTER TABLE public.payments ALTER COLUMN operation_id SET DEFAULT gen_random_uuid();

CREATE FUNCTION public.create_payment_once(
  p_operation_id uuid, p_student_id uuid, p_amount numeric, p_date date
)
RETURNS public.payments
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  student_name text;
  saved public.payments;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  -- Match payments.amount numeric(10,2) on both the first request and retries.
  p_amount := round(p_amount, 2);
  IF p_operation_id IS NULL OR p_student_id IS NULL OR p_date IS NULL
     OR p_amount IS NULL OR p_amount = 0
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid payment details' USING ERRCODE = '22023';
  END IF;

  -- No client-supplied teacher/name, and no cross-tenant student references.
  SELECT s.name INTO student_name FROM public.students s
    WHERE s.id = p_student_id AND s.teacher_id = owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payments (operation_id, student_id, student, amount, date, teacher_id)
    VALUES (p_operation_id, p_student_id, student_name, p_amount, p_date, owner_id)
    ON CONFLICT ON CONSTRAINT payments_operation_id_key DO NOTHING
    RETURNING * INTO saved;

  IF NOT FOUND THEN
    -- Separate statement sees the winning concurrent transaction after INSERT waits.
    -- DO NOT UPDATE: retries must not rerun update triggers or alter a payment.
    SELECT * INTO saved FROM public.payments p
      WHERE p.operation_id = p_operation_id AND p.teacher_id = owner_id;
    IF NOT FOUND OR saved.student_id IS DISTINCT FROM p_student_id
       OR saved.amount IS DISTINCT FROM p_amount OR saved.date IS DISTINCT FROM p_date THEN
      RAISE EXCEPTION 'Payment operation already used with different details'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION public.create_payment_once(uuid, uuid, numeric, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_once(uuid, uuid, numeric, date)
  TO authenticated;

-- Keep existing unique(payment_id, recipient_type) claims, including old ones.
ALTER TABLE public.telegram_payment_notifications
  ADD COLUMN delivery_status text NOT NULL DEFAULT 'legacy_claimed'
    CHECK (delivery_status IN ('legacy_claimed', 'claimed', 'sent', 'unknown')),
  ADD COLUMN delivered_at timestamptz;

NOTIFY pgrst, 'reload schema';
COMMIT;
