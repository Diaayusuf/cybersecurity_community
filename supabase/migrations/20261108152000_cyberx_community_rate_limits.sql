-- M8: atomic, per-member Community write limits with one counter row per action.
-- Limits: 5 posts, 20 comments, and 60 reactions in an aligned 10-minute window.
BEGIN;

CREATE TABLE private.community_write_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('post', 'comment', 'reaction')),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (user_id, action)
);
ALTER TABLE private.community_write_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.community_write_rate_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.consume_community_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $function$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / 600) * 600);
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_action NOT IN ('post', 'comment', 'reaction')
     OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid Community rate-limit request' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.community_write_rate_limits AS current_window
    (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, v_window, 1)
  ON CONFLICT (user_id, action) DO UPDATE
    SET window_start = EXCLUDED.window_start,
        request_count = CASE
          WHEN current_window.window_start = EXCLUDED.window_start THEN current_window.request_count + 1
          ELSE 1
        END
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$function$;
REVOKE ALL ON FUNCTION private.consume_community_rate_limit(uuid, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_user_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
  END IF;
  IF v_user_id IS NULL OR (TG_OP = 'UPDATE' AND v_user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT p.display_name INTO v_display_name FROM public.member_profiles AS p WHERE p.user_id = v_user_id;
  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'Member profile missing' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'INSERT' AND NOT private.consume_community_rate_limit(v_user_id, 'post', 5) THEN
    RAISE EXCEPTION 'Community post limit reached' USING ERRCODE = 'P0001';
  END IF;
  NEW.author_id := v_user_id;
  NEW.author_display_name := v_display_name;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT p.display_name INTO v_display_name FROM public.member_profiles AS p WHERE p.user_id = v_user_id;
  IF v_display_name IS NULL THEN RAISE EXCEPTION 'Member profile missing' USING ERRCODE = '23503'; END IF;
  IF NOT private.consume_community_rate_limit(v_user_id, 'comment', 20) THEN
    RAISE EXCEPTION 'Community comment limit reached' USING ERRCODE = 'P0001';
  END IF;
  NEW.author_id := v_user_id;
  NEW.author_display_name := v_display_name;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT private.consume_community_rate_limit(auth.uid(), 'reaction', 60) THEN
    RAISE EXCEPTION 'Community reaction limit reached' USING ERRCODE = 'P0001';
  END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$function$;

COMMENT ON TABLE private.community_write_rate_limits IS 'Atomic per-member Community write counters. One row per member and action; aligned ten-minute windows.';
COMMENT ON FUNCTION private.consume_community_rate_limit(uuid, text, integer) IS 'Security-definer atomic Community write limiter; callable only by fixed-path trigger functions.';
COMMIT;
