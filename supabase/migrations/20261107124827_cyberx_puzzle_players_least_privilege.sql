-- CyberX M5. Local preparation only; review and stage-test before production apply.
BEGIN;

-- The audited legacy table predates this repository's migration history. Fresh
-- local Supabase projects need that exact starting relation and policies before
-- this incremental hardening migration can run. Existing databases are left
-- untouched by this bootstrap branch.
DO $local_baseline$
BEGIN
  IF to_regclass('public.puzzle_players') IS NULL THEN
    EXECUTE $table$
      CREATE TABLE public.puzzle_players (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        domain text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    $table$;
    EXECUTE 'CREATE UNIQUE INDEX puzzle_players_normalized_name_key ON public.puzzle_players (lower(btrim(name)))';
    EXECUTE 'ALTER TABLE public.puzzle_players ENABLE ROW LEVEL SECURITY';
    EXECUTE $select_policy$
      CREATE POLICY "Anyone can view puzzle players" ON public.puzzle_players
      FOR SELECT TO anon USING (true)
    $select_policy$;
    EXECUTE $insert_policy$
      CREATE POLICY "Anyone can insert puzzle players" ON public.puzzle_players
      FOR INSERT TO anon WITH CHECK (char_length(btrim(name)) BETWEEN 1 AND 40)
    $insert_policy$;
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.puzzle_players TO anon, authenticated';
  END IF;
END;
$local_baseline$;

ALTER TABLE public.puzzle_players ADD CONSTRAINT puzzle_players_name_contract_check
  CHECK (name ~ '[^[:space:]]' AND char_length(name) BETWEEN 1 AND 40) NOT VALID;
ALTER TABLE public.puzzle_players VALIDATE CONSTRAINT puzzle_players_name_contract_check;
ALTER TABLE public.puzzle_players ADD CONSTRAINT puzzle_players_domain_contract_check
  CHECK (domain IS NULL OR (domain ~ '[^[:space:]]' AND char_length(domain) BETWEEN 1 AND 40)) NOT VALID;
ALTER TABLE public.puzzle_players VALIDATE CONSTRAINT puzzle_players_domain_contract_check;

-- Retain public reads and anon inserts; do not let API roles update, delete,
-- truncate, or set database-generated id/created_at. Keep service_role unchanged.
REVOKE ALL PRIVILEGES ON TABLE public.puzzle_players FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, domain, created_at) ON TABLE public.puzzle_players TO anon;
GRANT INSERT (name, domain) ON TABLE public.puzzle_players TO anon;

ALTER POLICY "Anyone can insert puzzle players" ON public.puzzle_players TO anon
  WITH CHECK (
    name ~ '[^[:space:]]' AND char_length(name) BETWEEN 1 AND 40
    AND (domain IS NULL OR (domain ~ '[^[:space:]]' AND char_length(domain) BETWEEN 1 AND 40))
  );
-- Defaults below affect only future postgres-owned public objects and the
-- schema-local default ACL. They do not override global default ACL entries;
-- staging verification must inspect both scopes. Supabase-managed
-- supabase_admin defaults and service_role grants are intentionally unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
COMMIT;
