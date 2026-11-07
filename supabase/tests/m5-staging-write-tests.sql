-- CYBERX M5 STAGING WRITE TESTS — NEVER RUN IN PRODUCTION
-- This is intentionally separate from the read-only verifier.
-- Operator must positively verify the isolated staging project ref immediately
-- before execution. Use synthetic data only. This script ends with ROLLBACK.
-- Do not run until the M5 migration is applied to disposable staging and the
-- read-only verifier is reviewed. M6 subsequently revokes anon insert access.

BEGIN;
SET LOCAL ROLE anon;

DO $test$
DECLARE
  v_id uuid;
  v_created_at timestamptz;
  v_name text := 'm5stage_' || replace(gen_random_uuid()::text,'-','');
BEGIN
  -- Valid name/domain and generated UUID/timestamp.
  INSERT INTO public.puzzle_players(name, domain)
    VALUES (v_name, 'synthetic.test')
    RETURNING id, created_at INTO v_id, v_created_at;
  IF v_id IS NULL OR v_created_at IS NULL THEN
    RAISE EXCEPTION 'database defaults were not generated';
  END IF;

  -- Optional NULL domain remains valid.
  INSERT INTO public.puzzle_players(name, domain)
    VALUES (v_name || '_null_domain', NULL);

  -- Empty, whitespace-only, over-limit name, and null name are rejected.
  BEGIN INSERT INTO public.puzzle_players(name) VALUES (''); RAISE EXCEPTION 'empty name unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name) VALUES (E' \t\n '); RAISE EXCEPTION 'whitespace name unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name) VALUES (repeat('n',41)); RAISE EXCEPTION '41-character name unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name) VALUES (repeat('n',40) || ' '); RAISE EXCEPTION 'raw name longer than 40 unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name) VALUES (NULL); RAISE EXCEPTION 'null name unexpectedly accepted'; EXCEPTION WHEN not_null_violation THEN NULL; END;

  -- Optional domain validation.
  BEGIN INSERT INTO public.puzzle_players(name,domain) VALUES (v_name || '_blank_domain','  '); RAISE EXCEPTION 'blank domain unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name,domain) VALUES (v_name || '_long_domain',repeat('d',41)); RAISE EXCEPTION '41-character domain unexpectedly accepted'; EXCEPTION WHEN check_violation THEN NULL; END;

  -- API role cannot supply generated fields.
  BEGIN INSERT INTO public.puzzle_players(id,name) VALUES (gen_random_uuid(),v_name || '_explicit_id'); RAISE EXCEPTION 'explicit id unexpectedly accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.puzzle_players(name,created_at) VALUES (v_name || '_explicit_time',now()); RAISE EXCEPTION 'explicit timestamp unexpectedly accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- UPDATE must be denied. DELETE is checked against only this synthetic row.
  BEGIN UPDATE public.puzzle_players SET domain='changed.test' WHERE id=v_id; RAISE EXCEPTION 'UPDATE unexpectedly accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.puzzle_players WHERE id=v_id; RAISE EXCEPTION 'DELETE unexpectedly accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$test$;

-- Always revert synthetic rows, even when every assertion succeeds.
ROLLBACK;
