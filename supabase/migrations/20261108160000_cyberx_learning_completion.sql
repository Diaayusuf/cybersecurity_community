-- M7: member-confirmed Learning path completion. This records a self-attested
-- path milestone; it does not assert that lesson activities were validated.
BEGIN;

ALTER TABLE public.learning_progress
  ADD COLUMN completed_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.cyberx_complete_learning_path(p_track_id text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_completed_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_track_id NOT IN ('offensive-tradecraft','detection-engineering','secure-operations') THEN
    RAISE EXCEPTION 'Unknown learning path' USING ERRCODE = '22023';
  END IF;

  UPDATE public.learning_progress
     SET completed_at = COALESCE(completed_at, now())
   WHERE user_id = v_user_id AND track_id = p_track_id
  RETURNING completed_at INTO v_completed_at;

  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION 'Start this learning path before completing it' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_completed_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.cyberx_complete_learning_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyberx_complete_learning_path(text) TO authenticated;
COMMENT ON FUNCTION public.cyberx_complete_learning_path(text) IS
  'Records an authenticated member-confirmed path completion idempotently; this is self-attestation, not lesson validation.';

COMMENT ON COLUMN public.learning_progress.completed_at IS
  'Member-confirmed path completion timestamp; not evidence of completed lesson activities.';

COMMIT;
