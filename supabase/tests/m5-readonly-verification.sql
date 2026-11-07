-- Read-only structural checks. Run after migration in reviewed test/staging.
-- Output contains booleans and aggregate counts only, never player values.
WITH checks AS (
 SELECT 'RLS enabled' AS check_name,(SELECT relrowsecurity FROM pg_class WHERE oid='public.puzzle_players'::regclass) AS passed
 UNION ALL SELECT 'anon can select leaderboard',has_any_column_privilege('anon','public.puzzle_players','SELECT')
 UNION ALL SELECT 'anon can insert allowed fields',has_column_privilege('anon','public.puzzle_players','name','INSERT') AND has_column_privilege('anon','public.puzzle_players','domain','INSERT')
 UNION ALL SELECT 'anon has no table-level insert',NOT has_table_privilege('anon','public.puzzle_players','INSERT')
 UNION ALL SELECT 'anon cannot update',NOT has_table_privilege('anon','public.puzzle_players','UPDATE') AND NOT has_any_column_privilege('anon','public.puzzle_players','UPDATE')
 UNION ALL SELECT 'anon cannot delete',NOT has_table_privilege('anon','public.puzzle_players','DELETE')
 UNION ALL SELECT 'anon cannot truncate',NOT has_table_privilege('anon','public.puzzle_players','TRUNCATE')
 UNION ALL SELECT 'anon cannot references or trigger',NOT has_table_privilege('anon','public.puzzle_players','REFERENCES') AND NOT has_table_privilege('anon','public.puzzle_players','TRIGGER')
 UNION ALL SELECT 'anon cannot insert id',NOT has_column_privilege('anon','public.puzzle_players','id','INSERT')
 UNION ALL SELECT 'anon cannot insert created_at',NOT has_column_privilege('anon','public.puzzle_players','created_at','INSERT')
 UNION ALL SELECT 'anon can read four contract columns',
   has_column_privilege('anon','public.puzzle_players','id','SELECT') AND has_column_privilege('anon','public.puzzle_players','name','SELECT') AND has_column_privilege('anon','public.puzzle_players','domain','SELECT') AND has_column_privilege('anon','public.puzzle_players','created_at','SELECT')
 UNION ALL SELECT 'authenticated has no effective table or column access',
   NOT has_table_privilege('authenticated','public.puzzle_players','SELECT') AND NOT has_any_column_privilege('authenticated','public.puzzle_players','SELECT')
   AND NOT has_table_privilege('authenticated','public.puzzle_players','INSERT') AND NOT has_any_column_privilege('authenticated','public.puzzle_players','INSERT')
   AND NOT has_table_privilege('authenticated','public.puzzle_players','UPDATE') AND NOT has_any_column_privilege('authenticated','public.puzzle_players','UPDATE')
   AND NOT has_table_privilege('authenticated','public.puzzle_players','DELETE') AND NOT has_table_privilege('authenticated','public.puzzle_players','TRUNCATE')
   AND NOT has_table_privilege('authenticated','public.puzzle_players','REFERENCES') AND NOT has_table_privilege('authenticated','public.puzzle_players','TRIGGER')
 UNION ALL SELECT 'normalized-name unique index retained',EXISTS(SELECT 1 FROM pg_class i JOIN pg_index x ON x.indexrelid=i.oid WHERE i.relname='puzzle_players_name_unique' AND x.indisunique AND x.indrelid='public.puzzle_players'::regclass)
 UNION ALL SELECT 'name constraint validated',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.puzzle_players'::regclass AND conname='puzzle_players_name_contract_check' AND convalidated)
 UNION ALL SELECT 'domain constraint validated',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.puzzle_players'::regclass AND conname='puzzle_players_domain_contract_check' AND convalidated)
 UNION ALL SELECT 'postgres public schema-local defaults exclude API roles and PUBLIC',NOT EXISTS(
   SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype IN ('r','S','f') AND a.grantee IN (0,'anon'::regrole,'authenticated'::regrole))
)
SELECT check_name,passed FROM checks ORDER BY check_name;

-- Safe aggregate compatibility check; can also run before a migration.
SELECT count(*) AS row_count,
 count(*) FILTER(WHERE name IS NULL OR name !~ '[^[:space:]]' OR char_length(name) NOT BETWEEN 1 AND 40) AS invalid_name_count,
 count(*) FILTER(WHERE domain IS NOT NULL AND (domain !~ '[^[:space:]]' OR char_length(domain) NOT BETWEEN 1 AND 40)) AS invalid_domain_count
FROM public.puzzle_players;

-- Inspect global defaults separately. Per-schema REVOKE cannot cancel grants
-- supplied by the global default ACL. Any row here requires owner review.
SELECT d.defaclrole::regrole AS creator_role, d.defaclobjtype AS object_type,
       a.grantee::regrole AS grantee, a.privilege_type
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclrole = 'postgres'::regrole
  AND d.defaclnamespace = 0
  AND d.defaclobjtype IN ('r','S','f')
  AND a.grantee IN (0, 'anon'::regrole, 'authenticated'::regrole)
ORDER BY object_type, grantee, privilege_type;
