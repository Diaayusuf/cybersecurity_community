-- M6 read-only checks. Execute after the migrations in disposable staging.
-- Results contain structural booleans only; no player or secret values are selected.
WITH checks AS (
  SELECT 'verified solves RLS enabled' AS check_name,
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.puzzle_verified_solves'::regclass) AS passed
  UNION ALL SELECT 'rate table RLS enabled',
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'private.puzzle_submission_rate_limits'::regclass)
  UNION ALL SELECT 'idempotency table RLS enabled',
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'private.puzzle_submission_idempotency'::regclass)
  UNION ALL SELECT 'legacy table anon select only',
    has_column_privilege('anon','public.puzzle_players','id','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','name','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','domain','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','created_at','SELECT')
    AND NOT has_table_privilege('anon','public.puzzle_players','INSERT')
    AND NOT has_any_column_privilege('anon','public.puzzle_players','INSERT')
    AND NOT has_table_privilege('anon','public.puzzle_players','UPDATE')
    AND NOT has_table_privilege('anon','public.puzzle_players','DELETE')
    AND NOT has_table_privilege('anon','public.puzzle_players','TRUNCATE')
  UNION ALL SELECT 'legacy anon insert policy removed',
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='puzzle_players' AND cmd='INSERT' AND 'anon' = ANY(roles))
  UNION ALL SELECT 'anon can read public verified fields',
    has_column_privilege('anon','public.puzzle_verified_solves','id','SELECT')
    AND has_column_privilege('anon','public.puzzle_verified_solves','challenge_id','SELECT')
    AND has_column_privilege('anon','public.puzzle_verified_solves','name','SELECT')
    AND has_column_privilege('anon','public.puzzle_verified_solves','domain','SELECT')
    AND has_column_privilege('anon','public.puzzle_verified_solves','verified_at','SELECT')
  UNION ALL SELECT 'anon cannot write verified solves',
    NOT has_table_privilege('anon','public.puzzle_verified_solves','INSERT')
    AND NOT has_any_column_privilege('anon','public.puzzle_verified_solves','INSERT')
    AND NOT has_table_privilege('anon','public.puzzle_verified_solves','UPDATE')
    AND NOT has_table_privilege('anon','public.puzzle_verified_solves','DELETE')
    AND NOT has_table_privilege('anon','public.puzzle_verified_solves','TRUNCATE')
  UNION ALL SELECT 'authenticated cannot access trusted relations',
    NOT has_table_privilege('authenticated','public.puzzle_verified_solves','SELECT')
    AND NOT has_any_column_privilege('authenticated','public.puzzle_verified_solves','SELECT')
    AND NOT has_table_privilege('authenticated','private.puzzle_submission_rate_limits','SELECT')
    AND NOT has_table_privilege('authenticated','private.puzzle_submission_idempotency','SELECT')
  UNION ALL SELECT 'private schema inaccessible to API roles',
    NOT has_schema_privilege('anon','private','USAGE')
    AND NOT has_schema_privilege('authenticated','private','USAGE')
    AND NOT has_schema_privilege('service_role','private','USAGE')
  UNION ALL SELECT 'anon cannot execute rate RPC',
    NOT has_function_privilege('anon','public.consume_puzzle_rate_limit(text)','EXECUTE')
  UNION ALL SELECT 'anon cannot execute submission RPC',
    NOT has_function_privilege('anon','public.commit_puzzle_submission(text,text,text,text,text,boolean)','EXECUTE')
  UNION ALL SELECT 'authenticated cannot execute M6 RPCs',
    NOT has_function_privilege('authenticated','public.consume_puzzle_rate_limit(text)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.commit_puzzle_submission(text,text,text,text,text,boolean)','EXECUTE')
  UNION ALL SELECT 'service role executes only intended RPC boundary',
    has_function_privilege('service_role','public.consume_puzzle_rate_limit(text)','EXECUTE')
    AND has_function_privilege('service_role','public.commit_puzzle_submission(text,text,text,text,text,boolean)','EXECUTE')
    AND NOT has_table_privilege('service_role','public.puzzle_verified_solves','INSERT')
    AND NOT has_table_privilege('service_role','private.puzzle_submission_rate_limits','SELECT')
  UNION ALL SELECT 'RPCs are fixed-search-path security definers owned by postgres',
    (SELECT count(*) = 2 FROM pg_catalog.pg_proc p
      WHERE p.oid IN (
        'public.consume_puzzle_rate_limit(text)'::regprocedure,
        'public.commit_puzzle_submission(text,text,text,text,text,boolean)'::regprocedure
      ) AND p.prosecdef AND p.proowner = 'postgres'::regrole
        AND p.proconfig @> ARRAY['search_path=pg_catalog'])
  UNION ALL SELECT 'public leaderboard view is security invoker',
    EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='public.puzzle_leaderboard'::regclass
      AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true'])
    AND has_any_column_privilege('anon','public.puzzle_leaderboard','SELECT')
    AND has_column_privilege('anon','public.puzzle_leaderboard','id','SELECT')
    AND has_column_privilege('anon','public.puzzle_leaderboard','name','SELECT')
    AND has_column_privilege('anon','public.puzzle_leaderboard','domain','SELECT')
    AND has_column_privilege('anon','public.puzzle_leaderboard','created_at','SELECT')
    AND has_column_privilege('anon','public.puzzle_leaderboard','verification_status','SELECT')
  UNION ALL SELECT 'verified solves in Realtime publication',
    EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='puzzle_verified_solves')
  UNION ALL SELECT 'normalized challenge name uniqueness exists',
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.puzzle_verified_solves'::regclass
        AND conname='puzzle_verified_solves_challenge_name_key' AND contype='u')
  UNION ALL SELECT 'idempotency uniqueness exists',
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid='private.puzzle_submission_idempotency'::regclass
        AND conname='puzzle_submission_idempotency_pkey' AND contype='p')
)
SELECT check_name, passed FROM checks ORDER BY check_name;