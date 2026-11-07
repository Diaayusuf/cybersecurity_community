-- M6: preserve legacy Hall of Fame rows while restricting all new trusted writes
-- to the submit-puzzle Edge Function through service-role-only RPCs.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.puzzle_verified_solves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id text NOT NULL CHECK (challenge_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text NOT NULL CHECK (name ~ '[^[:space:]]' AND char_length(btrim(name)) BETWEEN 1 AND 40),
  domain text NULL CHECK (domain IS NULL OR (domain ~ '[^[:space:]]' AND char_length(btrim(domain)) BETWEEN 1 AND 40)),
  verified_at timestamptz NOT NULL DEFAULT now(),
  normalized_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  CONSTRAINT puzzle_verified_solves_challenge_name_key UNIQUE (challenge_id, normalized_name)
);
ALTER TABLE public.puzzle_verified_solves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read verified puzzle solves"
  ON public.puzzle_verified_solves FOR SELECT TO anon USING (true);
REVOKE ALL PRIVILEGES ON TABLE public.puzzle_verified_solves FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id, challenge_id, name, domain, verified_at)
  ON TABLE public.puzzle_verified_solves TO anon;

CREATE TABLE private.puzzle_submission_rate_limits (
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (source_fingerprint, window_start)
);
CREATE INDEX puzzle_submission_rate_limits_window_idx
  ON private.puzzle_submission_rate_limits (window_start);
ALTER TABLE private.puzzle_submission_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE private.puzzle_submission_idempotency (
  challenge_id text NOT NULL CHECK (challenge_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  idempotency_hash text NOT NULL CHECK (idempotency_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('processing', 'incorrect', 'verified', 'already_exists')),
  solve_id uuid NULL REFERENCES public.puzzle_verified_solves(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, idempotency_hash),
  CHECK ((outcome = 'verified' AND solve_id IS NOT NULL) OR (outcome <> 'verified' AND solve_id IS NULL))
);
CREATE INDEX puzzle_submission_idempotency_created_idx ON private.puzzle_submission_idempotency (created_at);
ALTER TABLE private.puzzle_submission_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

-- The legacy table remains readable as historical data but cannot accept new
-- unverified submissions from browser roles. Existing rows are untouched.
REVOKE ALL PRIVILEGES ON TABLE public.puzzle_players FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, domain, created_at) ON TABLE public.puzzle_players TO anon;
DROP POLICY IF EXISTS "Anyone can insert puzzle players" ON public.puzzle_players;

CREATE OR REPLACE VIEW public.puzzle_leaderboard
  WITH (security_invoker = true)
AS
  SELECT id, name, domain, created_at, 'legacy_unverified'::text AS verification_status
    FROM public.puzzle_players
  UNION ALL
  SELECT id, name, domain, verified_at AS created_at, 'server_verified'::text AS verification_status
    FROM public.puzzle_verified_solves;
REVOKE ALL PRIVILEGES ON TABLE public.puzzle_leaderboard FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id, name, domain, created_at, verification_status)
  ON TABLE public.puzzle_leaderboard TO anon;

CREATE OR REPLACE FUNCTION public.consume_puzzle_rate_limit(p_source_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_count integer;
  v_retry_after integer;
BEGIN
  IF p_source_fingerprint IS NULL OR p_source_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid request';
  END IF;
  DELETE FROM private.puzzle_submission_rate_limits WHERE window_start < v_now - interval '48 hours';
  v_window := to_timestamp(floor(extract(epoch FROM v_now) / 600) * 600);
  INSERT INTO private.puzzle_submission_rate_limits AS limits
    (source_fingerprint, window_start, request_count)
  VALUES (p_source_fingerprint, v_window, 1)
  ON CONFLICT (source_fingerprint, window_start)
  DO UPDATE SET request_count = limits.request_count + 1
  RETURNING request_count INTO v_count;
  IF v_count > 8 THEN
    v_retry_after := greatest(1, ceil(extract(epoch FROM (v_window + interval '10 minutes' - v_now)))::integer);
    RETURN jsonb_build_object('allowed', false, 'retry_after', v_retry_after);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.commit_puzzle_submission(
  p_challenge_id text,
  p_idempotency_hash text,
  p_request_hash text,
  p_player_name text,
  p_domain text,
  p_verified boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_existing private.puzzle_submission_idempotency%ROWTYPE;
  v_inserted_hash text;
  v_solve_id uuid;
  v_verified_at timestamptz;
  v_outcome text;
BEGIN
  IF p_challenge_id IS NULL OR p_challenge_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     OR p_idempotency_hash IS NULL OR p_idempotency_hash !~ '^[a-f0-9]{64}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$'
     OR p_verified IS NULL
     OR p_player_name IS NULL OR p_player_name !~ '[^[:space:]]'
     OR char_length(btrim(p_player_name)) NOT BETWEEN 1 AND 40
     OR (p_domain IS NOT NULL AND (p_domain !~ '[^[:space:]]' OR char_length(btrim(p_domain)) NOT BETWEEN 1 AND 40)) THEN
    RAISE EXCEPTION 'invalid request';
  END IF;

  DELETE FROM private.puzzle_submission_idempotency WHERE created_at < clock_timestamp() - interval '90 days';
  SELECT * INTO v_existing
    FROM private.puzzle_submission_idempotency
    WHERE challenge_id = p_challenge_id AND idempotency_hash = p_idempotency_hash
    FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash <> p_request_hash THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_existing.outcome = 'verified' THEN
      SELECT verified_at INTO v_verified_at FROM public.puzzle_verified_solves WHERE id = v_existing.solve_id;
      RETURN jsonb_build_object('status', 'verified', 'solve_id', v_existing.solve_id, 'verified_at', v_verified_at);
    END IF;
    RETURN jsonb_build_object('status', v_existing.outcome);
  END IF;

  INSERT INTO private.puzzle_submission_idempotency
    (challenge_id, idempotency_hash, request_hash, outcome)
  VALUES (p_challenge_id, p_idempotency_hash, p_request_hash, 'processing')
  ON CONFLICT (challenge_id, idempotency_hash) DO NOTHING
  RETURNING idempotency_hash INTO v_inserted_hash;
  IF v_inserted_hash IS NULL THEN
    SELECT * INTO v_existing
      FROM private.puzzle_submission_idempotency
      WHERE challenge_id = p_challenge_id AND idempotency_hash = p_idempotency_hash
      FOR UPDATE;
    IF v_existing.request_hash <> p_request_hash THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_existing.outcome = 'verified' THEN
      SELECT verified_at INTO v_verified_at FROM public.puzzle_verified_solves WHERE id = v_existing.solve_id;
      RETURN jsonb_build_object('status', 'verified', 'solve_id', v_existing.solve_id, 'verified_at', v_verified_at);
    END IF;
    RETURN jsonb_build_object('status', v_existing.outcome);
  END IF;

  IF NOT p_verified THEN
    UPDATE private.puzzle_submission_idempotency
      SET outcome = 'incorrect'
      WHERE challenge_id = p_challenge_id AND idempotency_hash = p_idempotency_hash;
    RETURN jsonb_build_object('status', 'incorrect');
  END IF;

  INSERT INTO public.puzzle_verified_solves (challenge_id, name, domain)
  VALUES (p_challenge_id, btrim(p_player_name), NULLIF(btrim(p_domain), ''))
  ON CONFLICT (challenge_id, normalized_name) DO NOTHING
  RETURNING id, verified_at INTO v_solve_id, v_verified_at;
  IF v_solve_id IS NULL THEN
    UPDATE private.puzzle_submission_idempotency
      SET outcome = 'already_exists'
      WHERE challenge_id = p_challenge_id AND idempotency_hash = p_idempotency_hash;
    RETURN jsonb_build_object('status', 'already_exists');
  END IF;

  UPDATE private.puzzle_submission_idempotency
    SET outcome = 'verified', solve_id = v_solve_id
    WHERE challenge_id = p_challenge_id AND idempotency_hash = p_idempotency_hash;
  RETURN jsonb_build_object('status', 'verified', 'solve_id', v_solve_id, 'verified_at', v_verified_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_puzzle_rate_limit(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_puzzle_rate_limit(text) TO service_role;
REVOKE ALL ON FUNCTION public.commit_puzzle_submission(text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_puzzle_submission(text, text, text, text, text, boolean) TO service_role;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'puzzle_verified_solves'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.puzzle_verified_solves';
  END IF;
END;
$publication$;

COMMENT ON TABLE public.puzzle_verified_solves IS 'Puzzle solves inserted only by the service-role-only verification RPC after Edge Function validation.';
COMMENT ON TABLE private.puzzle_submission_rate_limits IS 'Short-lived keyed source fingerprints and request counters; contains no raw IP addresses.';
COMMENT ON TABLE private.puzzle_submission_idempotency IS 'Private keyed idempotency state; contains no submitted or expected answers.';

COMMIT;