BEGIN;

ALTER TABLE public.payments ALTER COLUMN operation_id DROP DEFAULT;

-- A row lock shared by INSERT and recovery decides which request wins.
-- Keep the result even if a keyed payment is later intentionally deleted.
CREATE TABLE public.payment_operation_guard (
  teacher_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  payment_id bigint,
  PRIMARY KEY (teacher_id, operation_id),
  CHECK (NOT cancelled OR payment_id IS NULL)
);
ALTER TABLE public.payment_operation_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_operation_guard FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.payment_operation_guard (teacher_id, operation_id, payment_id)
SELECT teacher_id, operation_id, id FROM public.payments
  WHERE teacher_id IS NOT NULL AND operation_id IS NOT NULL;

CREATE FUNCTION public.enforce_payment_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  guard public.payment_operation_guard;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.operation_id IS DISTINCT FROM OLD.operation_id OR
       (OLD.operation_id IS NOT NULL AND NEW.teacher_id IS DISTINCT FROM OLD.teacher_id) THEN
      RAISE EXCEPTION 'Payment operation identity cannot change' USING ERRCODE = '22023';
    END IF;
    IF NEW.student_id IS NOT NULL AND
       (NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.students s WHERE s.id = NEW.student_id AND s.teacher_id = NEW.teacher_id
       ) THEN
      RAISE EXCEPTION 'Payment student must belong to the teacher' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.operation_id IS NULL THEN
    RAISE EXCEPTION 'Payment operation ID is required. Reload ProfiProfit and try again.'
      USING ERRCODE = '23502', COLUMN = 'operation_id';
  END IF;
  IF NEW.teacher_id IS NULL OR NEW.student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.id = NEW.student_id AND s.teacher_id = NEW.teacher_id
  ) THEN
    RAISE EXCEPTION 'Payment student must belong to the teacher' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payment_operation_guard (teacher_id, operation_id)
    VALUES (NEW.teacher_id, NEW.operation_id)
    ON CONFLICT (teacher_id, operation_id) DO UPDATE SET operation_id = EXCLUDED.operation_id
    RETURNING * INTO guard;

  IF guard.cancelled OR (guard.payment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = guard.payment_id AND p.teacher_id = NEW.teacher_id AND p.operation_id = NEW.operation_id
  )) THEN
    RAISE EXCEPTION 'Payment operation is closed; check payment history' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.remember_payment_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.payment_operation_guard g SET payment_id = NEW.id
    WHERE g.teacher_id = NEW.teacher_id AND g.operation_id = NEW.operation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER require_payment_operation_id
  BEFORE INSERT OR UPDATE OF operation_id, teacher_id, student_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_operation();
CREATE TRIGGER retain_payment_operation_result
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.remember_payment_operation();

CREATE FUNCTION public.reconcile_payment_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  guard public.payment_operation_guard;
  saved public.payments;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'Payment operation ID is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_operation_guard (teacher_id, operation_id)
    VALUES (owner_id, p_operation_id)
    ON CONFLICT (teacher_id, operation_id) DO UPDATE SET operation_id = EXCLUDED.operation_id
    RETURNING * INTO guard;

  SELECT * INTO saved FROM public.payments p
    WHERE p.teacher_id = owner_id AND p.operation_id = p_operation_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'saved', 'id', saved.id, 'student_id', saved.student_id);
  END IF;
  IF guard.payment_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'removed');
  END IF;

  UPDATE public.payment_operation_guard g SET cancelled = true
    WHERE g.teacher_id = owner_id AND g.operation_id = p_operation_id;
  RETURN jsonb_build_object('status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_payment_operation(), public.remember_payment_operation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reconcile_payment_operation(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_payment_operation(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
