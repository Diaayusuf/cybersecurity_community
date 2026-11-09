-- M7 local catalog verification. Read-only and safe for disposable local DBs.
WITH checks AS (
  SELECT 'profile, post, comment, and reaction RLS enabled' AS check_name,
    (SELECT count(*) = 4 FROM pg_catalog.pg_class c
      WHERE c.oid IN ('public.member_profiles'::regclass, 'public.community_posts'::regclass,
        'public.community_comments'::regclass, 'public.community_reactions'::regclass)
        AND c.relrowsecurity) AS passed
  UNION ALL SELECT 'anonymous cannot read profile or base community tables',
    NOT has_table_privilege('anon','public.member_profiles','SELECT')
    AND NOT has_any_column_privilege('anon','public.member_profiles','SELECT')
    AND NOT has_table_privilege('anon','public.community_posts','SELECT')
    AND NOT has_any_column_privilege('anon','public.community_posts','SELECT')
    AND NOT has_table_privilege('anon','public.community_comments','SELECT')
    AND NOT has_any_column_privilege('anon','public.community_comments','SELECT')
  UNION ALL SELECT 'anonymous can read only the curated feed views',
    has_table_privilege('anon','public.community_feed','SELECT')
    AND has_table_privilege('anon','public.community_comment_feed','SELECT')
    AND NOT has_table_privilege('anon','public.community_reactions','SELECT')
  UNION ALL SELECT 'authenticated profile reads and updates are column-scoped',
    has_column_privilege('authenticated','public.member_profiles','user_id','SELECT')
    AND has_column_privilege('authenticated','public.member_profiles','display_name','UPDATE')
    AND NOT has_table_privilege('authenticated','public.member_profiles','INSERT')
    AND NOT has_table_privilege('authenticated','public.member_profiles','DELETE')
  UNION ALL SELECT 'authenticated community cannot select author UUID columns',
    NOT has_column_privilege('authenticated','public.community_posts','author_id','SELECT')
    AND NOT has_column_privilege('authenticated','public.community_comments','author_id','SELECT')
  UNION ALL SELECT 'post writes omit author identity and include a request idempotency key',
    has_column_privilege('authenticated','public.community_posts','title','INSERT')
    AND has_column_privilege('authenticated','public.community_posts','idempotency_key','INSERT')
    AND NOT has_column_privilege('authenticated','public.community_posts','author_id','INSERT')
    AND NOT has_column_privilege('authenticated','public.community_posts','author_display_name','INSERT')
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.community_posts'::regclass AND conname='community_posts_author_request_key' AND contype='u')
  UNION ALL SELECT 'reaction uniqueness enforces one like per user and post',
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.community_reactions'::regclass AND contype='p'
        AND pg_catalog.pg_get_constraintdef(oid) LIKE '%post_id, user_id%')
  UNION ALL SELECT 'community rate counters are RLS-protected and API-inaccessible',
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='private.community_write_rate_limits'::regclass)
    AND NOT has_schema_privilege('anon','private','USAGE')
    AND NOT has_schema_privilege('authenticated','private','USAGE')
    AND NOT has_table_privilege('service_role','private.community_write_rate_limits','SELECT')
  UNION ALL SELECT 'community rate limiter is atomic security-definer and non-callable by API roles',
    (SELECT prosecdef AND proowner='postgres'::regrole
      AND proconfig @> ARRAY['search_path=pg_catalog, private']
      FROM pg_catalog.pg_proc
      WHERE oid='private.consume_community_rate_limit(uuid,text,integer)'::regprocedure)
    AND NOT has_function_privilege('anon','private.consume_community_rate_limit(uuid,text,integer)','EXECUTE')
    AND NOT has_function_privilege('authenticated','private.consume_community_rate_limit(uuid,text,integer)','EXECUTE')
    AND NOT has_function_privilege('service_role','private.consume_community_rate_limit(uuid,text,integer)','EXECUTE')
  UNION ALL SELECT 'owner-scoped mutation policies exist',
    (SELECT count(*) = 4 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='community_posts'
        AND policyname IN ('Members can create their own posts','Members can update their own posts','Members can delete their own posts','Members read published posts and moderators read all posts'))
    AND (SELECT count(*) = 3 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='community_comments'
        AND policyname IN ('Members can create their own comments','Members can delete their own comments','Signed-in members can read comments'))
    AND (SELECT count(*) = 3 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='community_reactions'
        AND policyname IN ('Members can read their own reactions','Members can react as themselves','Members can remove their own reactions'))
  UNION ALL SELECT 'author identity triggers are fixed-path security definers',
    (SELECT count(*) = 5 FROM pg_catalog.pg_proc p
      WHERE p.oid IN ('public.cyberx_guard_community_post()'::regprocedure,
        'public.cyberx_guard_community_comment()'::regprocedure,
        'public.cyberx_guard_community_reaction()'::regprocedure,
        'public.cyberx_guard_community_report()'::regprocedure,
        'public.cyberx_guard_community_suggestion()'::regprocedure)
        AND p.prosecdef AND p.proowner='postgres'::regrole
        AND (p.proconfig @> ARRAY['search_path=pg_catalog, public'] OR p.proconfig @> ARRAY['search_path=pg_catalog, public, private']))
  UNION ALL SELECT 'M5 legacy constraints and normalized unique name index remain active',
    (SELECT count(*) = 2 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.puzzle_players'::regclass AND contype='c' AND convalidated
        AND conname IN ('puzzle_players_name_contract_check','puzzle_players_domain_contract_check'))
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_index i
      WHERE i.indrelid='public.puzzle_players'::regclass AND i.indisunique
        AND pg_catalog.pg_get_indexdef(i.indexrelid) ILIKE '%lower%' AND pg_catalog.pg_get_indexdef(i.indexrelid) ILIKE '%btrim%')
  UNION ALL SELECT 'M5 legacy reader grants remain narrow and writable grants remain revoked',
    has_column_privilege('anon','public.puzzle_players','name','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','domain','SELECT')
    AND NOT has_table_privilege('anon','public.puzzle_players','INSERT')
    AND NOT has_any_column_privilege('anon','public.puzzle_players','INSERT')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','SELECT')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','INSERT')
  UNION ALL SELECT 'learning progress is private, owner-scoped, and author identity is trigger-assigned',
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.learning_progress'::regclass)
    AND NOT has_table_privilege('anon','public.learning_progress','SELECT')
    AND NOT has_table_privilege('authenticated','public.learning_progress','INSERT')
    AND NOT has_column_privilege('authenticated','public.learning_progress','user_id','INSERT')
    AND has_column_privilege('authenticated','public.learning_progress','track_id','INSERT')
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='learning_progress'
        AND policyname='Members can read their own learning progress' AND cmd='SELECT'
        AND qual LIKE '%auth.uid%')
  UNION ALL SELECT 'learning progress trigger has a fixed search path',
    EXISTS (SELECT 1 FROM pg_catalog.pg_proc
      WHERE oid='public.cyberx_guard_learning_progress()'::regprocedure
        AND prosecdef AND proowner='postgres'::regrole
        AND proconfig @> ARRAY['search_path=pg_catalog, public'])
  UNION ALL SELECT 'learning completion is idempotent and cannot be called anonymously',
    EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid='public.cyberx_complete_learning_path(text)'::regprocedure AND prosecdef
      AND proconfig @> ARRAY['search_path=pg_catalog, public'])
    AND has_column_privilege('authenticated','public.learning_progress','completed_at','SELECT')
    AND NOT has_function_privilege('anon','public.cyberx_complete_learning_path(text)','EXECUTE')
    AND has_function_privilege('authenticated','public.cyberx_complete_learning_path(text)','EXECUTE')
  UNION ALL SELECT 'trusted moderation role has no anonymous execution and uses signed app metadata',
    (SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog'] FROM pg_catalog.pg_proc WHERE oid='public.cyberx_has_moderation_role()'::regprocedure)
    AND NOT has_function_privilege('anon','public.cyberx_has_moderation_role()','EXECUTE')
    AND has_function_privilege('authenticated','public.cyberx_has_moderation_role()','EXECUTE')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_profiles' AND column_name IN ('role','is_admin','moderator'))
  UNION ALL SELECT 'report and suggestion rows enforce RLS and session identity insert grants',
    (SELECT count(*) = 2 FROM pg_catalog.pg_class WHERE oid IN ('public.community_reports'::regclass,'public.community_suggestions'::regclass) AND relrowsecurity)
    AND has_column_privilege('authenticated','public.community_reports','post_id','INSERT')
    AND NOT has_column_privilege('authenticated','public.community_reports','reporter_id','INSERT')
    AND has_column_privilege('authenticated','public.community_suggestions','title','INSERT')
    AND NOT has_column_privilege('authenticated','public.community_suggestions','author_id','INSERT')
    AND NOT has_table_privilege('anon','public.community_reports','INSERT')
    AND NOT has_table_privilege('anon','public.community_suggestions','INSERT')
  UNION ALL SELECT 'moderation audit is immutable to API roles and private to trusted reviewers',
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='private.community_moderation_audit'::regclass)
    AND NOT has_schema_privilege('authenticated','private','USAGE')
    AND NOT has_table_privilege('authenticated','private.community_moderation_audit','INSERT')
    AND NOT has_table_privilege('authenticated','private.community_moderation_audit','UPDATE')
    AND NOT has_table_privilege('authenticated','private.community_moderation_audit','DELETE')
  UNION ALL SELECT 'review RPC checks role and does not allow anonymous execution',
    (SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public, private'] FROM pg_catalog.pg_proc WHERE oid='public.cyberx_review_community_item(text,uuid,text,text)'::regprocedure)
    AND NOT has_function_privilege('anon','public.cyberx_review_community_item(text,uuid,text,text)','EXECUTE')
    AND has_function_privilege('authenticated','public.cyberx_review_community_item(text,uuid,text,text)','EXECUTE')
  UNION ALL SELECT 'public feed excludes hidden and removed posts',
    pg_catalog.pg_get_viewdef('public.community_feed'::regclass, true) ILIKE '%moderation_status%published%'
  UNION ALL SELECT 'report uniqueness and rate counters cover safety workflows',
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.community_reports'::regclass AND contype='u')
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.community_suggestions'::regclass AND contype='u')
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='private.community_write_rate_limits'::regclass AND pg_catalog.pg_get_constraintdef(oid) LIKE '%suggestion%')
)
SELECT check_name, passed FROM checks ORDER BY check_name;
