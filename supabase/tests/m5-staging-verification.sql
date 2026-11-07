-- CYBERX M5 STAGING VERIFICATION — READ ONLY
-- Safe SELECT/catalog inspection only. This file performs no writes.
-- Run only after positively identifying an isolated test/staging database and
-- after applying M5 there. It returns no player values.

WITH checks AS (
  SELECT 'RLS enabled (not forced)' AS check_name,
    (SELECT c.relrowsecurity AND NOT c.relforcerowsecurity
       FROM pg_catalog.pg_class c WHERE c.oid='public.puzzle_players'::regclass) AS passed
  UNION ALL SELECT 'anon has SELECT on required columns',
    has_column_privilege('anon','public.puzzle_players','id','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','name','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','domain','SELECT')
    AND has_column_privilege('anon','public.puzzle_players','created_at','SELECT')
  UNION ALL SELECT 'anon can INSERT only form columns',
    has_column_privilege('anon','public.puzzle_players','name','INSERT')
    AND has_column_privilege('anon','public.puzzle_players','domain','INSERT')
    AND NOT has_column_privilege('anon','public.puzzle_players','id','INSERT')
    AND NOT has_column_privilege('anon','public.puzzle_players','created_at','INSERT')
  UNION ALL SELECT 'anon has no broad mutation privileges',
    NOT has_table_privilege('anon','public.puzzle_players','INSERT')
    AND NOT has_table_privilege('anon','public.puzzle_players','UPDATE')
    AND NOT has_any_column_privilege('anon','public.puzzle_players','UPDATE')
    AND NOT has_table_privilege('anon','public.puzzle_players','DELETE')
    AND NOT has_table_privilege('anon','public.puzzle_players','TRUNCATE')
    AND NOT has_table_privilege('anon','public.puzzle_players','REFERENCES')
    AND NOT has_table_privilege('anon','public.puzzle_players','TRIGGER')
  UNION ALL SELECT 'authenticated has no effective table or column access',
    NOT has_table_privilege('authenticated','public.puzzle_players','SELECT')
    AND NOT has_any_column_privilege('authenticated','public.puzzle_players','SELECT')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','INSERT')
    AND NOT has_any_column_privilege('authenticated','public.puzzle_players','INSERT')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','UPDATE')
    AND NOT has_any_column_privilege('authenticated','public.puzzle_players','UPDATE')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','DELETE')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','TRUNCATE')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','REFERENCES')
    AND NOT has_table_privilege('authenticated','public.puzzle_players','TRIGGER')
  UNION ALL SELECT 'service_role legacy grants remain intact',
    has_table_privilege('service_role','public.puzzle_players','SELECT')
    AND has_table_privilege('service_role','public.puzzle_players','INSERT')
    AND has_table_privilege('service_role','public.puzzle_players','UPDATE')
    AND has_table_privilege('service_role','public.puzzle_players','DELETE')
  UNION ALL SELECT 'name/domain constraints exist and are validated',
    (SELECT count(*)=2 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.puzzle_players'::regclass
        AND conname IN ('puzzle_players_name_contract_check','puzzle_players_domain_contract_check')
        AND contype='c' AND convalidated)
  UNION ALL SELECT 'constraints match raw field length and non-whitespace contract',
    (SELECT count(*)=2 FROM pg_catalog.pg_constraint
      WHERE conrelid='public.puzzle_players'::regclass AND convalidated
        AND pg_catalog.pg_get_constraintdef(oid) LIKE '%char_length%'
        AND pg_catalog.pg_get_constraintdef(oid) LIKE '%40%')
  UNION ALL SELECT 'normalized-name unique index exists',
    EXISTS (SELECT 1 FROM pg_catalog.pg_index i
      WHERE i.indrelid='public.puzzle_players'::regclass AND i.indisunique
        AND pg_catalog.pg_get_indexdef(i.indexrelid) ILIKE '%lower%'
        AND pg_catalog.pg_get_indexdef(i.indexrelid) ILIKE '%btrim%')
  UNION ALL SELECT 'select policy remains public and permissive by design',
    EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='puzzle_players'
        AND policyname='Anyone can view puzzle players' AND cmd='SELECT'
        AND 'anon'=ANY(roles) AND qual='true')
  UNION ALL SELECT 'only the intended anon insert policy applies',
    (SELECT count(*)=1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='puzzle_players'
        AND cmd='INSERT' AND 'anon'=ANY(roles))
  UNION ALL SELECT 'insert policy requires bounded non-whitespace fields',
    EXISTS (SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='puzzle_players'
        AND policyname='Anyone can insert puzzle players' AND cmd='INSERT'
        AND 'anon'=ANY(roles) AND with_check LIKE '%char_length%'
        AND with_check LIKE '%40%' AND with_check LIKE '%domain%')
  UNION ALL SELECT 'no table-owned sequence is exposed to API roles',
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class s
      JOIN pg_catalog.pg_depend dep ON dep.objid=s.oid AND dep.refobjid='public.puzzle_players'::regclass
        AND dep.deptype IN ('a','i')
      WHERE s.relkind='S'
        AND (has_sequence_privilege('anon',s.oid,'USAGE') OR has_sequence_privilege('anon',s.oid,'SELECT') OR has_sequence_privilege('anon',s.oid,'UPDATE')
          OR has_sequence_privilege('authenticated',s.oid,'USAGE') OR has_sequence_privilege('authenticated',s.oid,'SELECT') OR has_sequence_privilege('authenticated',s.oid,'UPDATE')))
  UNION ALL SELECT 'no effective API defaults grant public object privileges',
    NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_default_acl d
      CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
      WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype IN ('r','S','f')
        AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole))
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_default_acl d
      CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
      WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace=0
        AND d.defaclobjtype IN ('r','S','f')
        AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole))
)
SELECT check_name, passed FROM checks ORDER BY check_name;

-- Effective grants include PUBLIC and inherited role grants:
SELECT role_name, privilege,
       pg_catalog.has_table_privilege(role_name,'public.puzzle_players',privilege) AS effective
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
ORDER BY role_name, privilege;

-- Report all policy definitions for OR-semantics review (no row data):
SELECT policyname, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='puzzle_players'
ORDER BY cmd, policyname;

-- Report expected schema/table shape, indexes, and relevant default ACL entries:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='puzzle_players'
ORDER BY ordinal_position;

SELECT indexname, indexdef FROM pg_catalog.pg_indexes
WHERE schemaname='public' AND tablename='puzzle_players' ORDER BY indexname;

SELECT d.defaclrole::regrole AS creator_role,
       CASE WHEN d.defaclnamespace=0 THEN '<global>' ELSE n.nspname END AS acl_scope,
       d.defaclobjtype AS object_type,
       a.grantee::regrole AS grantee, a.privilege_type
FROM pg_catalog.pg_default_acl d
CROSS JOIN LATERAL (SELECT nspname FROM pg_catalog.pg_namespace WHERE oid=d.defaclnamespace) n
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
WHERE d.defaclrole IN ('postgres'::regrole,'supabase_admin'::regrole)
  AND d.defaclobjtype IN ('r','S','f')
ORDER BY creator_role, acl_scope, object_type, grantee, privilege_type;

-- Aggregate compatibility only; do not select player names or domains:
SELECT count(*) AS row_count,
       count(*) FILTER (WHERE name IS NULL OR name !~ '[^[:space:]]' OR char_length(name) NOT BETWEEN 1 AND 40) AS invalid_name_count,
       count(*) FILTER (WHERE domain IS NOT NULL AND (domain !~ '[^[:space:]]' OR char_length(domain) NOT BETWEEN 1 AND 40)) AS invalid_domain_count
FROM public.puzzle_players;
