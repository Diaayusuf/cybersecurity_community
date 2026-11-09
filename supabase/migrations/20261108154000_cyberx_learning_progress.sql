-- M7: persist only the supported Learning action (starting a catalog path).
-- No lesson-completion or achievement state is claimed without activities.
BEGIN;

CREATE TABLE public.learning_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id text NOT NULL CHECK (track_id IN ('offensive-tradecraft','detection-engineering','secure-operations')),
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX learning_progress_user_started_idx ON public.learning_progress (user_id, started_at DESC);
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, track_id, started_at), INSERT (track_id)
  ON public.learning_progress TO authenticated;
CREATE POLICY "Members can read their own learning progress" ON public.learning_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Members can start learning paths as themselves" ON public.learning_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.cyberx_guard_learning_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  NEW.user_id := auth.uid();
  NEW.started_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_learning_progress() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_learning_progress
  BEFORE INSERT ON public.learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_learning_progress();
COMMENT ON TABLE public.learning_progress IS 'Member-owned started-path records. It does not represent lesson completion or achievements.';
COMMIT;
