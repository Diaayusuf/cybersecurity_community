-- M8: report, suggestion, and moderation workflows secured by signed
-- Supabase app_metadata and owner-scoped RLS. Role assignment is server-only.
BEGIN;

CREATE OR REPLACE FUNCTION public.cyberx_has_moderation_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'cyberx_role' IN ('admin', 'moderator'), false);
$function$;
REVOKE ALL ON FUNCTION public.cyberx_has_moderation_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyberx_has_moderation_role() TO authenticated;

ALTER TABLE public.community_posts
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('published','hidden','removed'));
DROP POLICY IF EXISTS "Signed-in members can read posts" ON public.community_posts;
CREATE POLICY "Members read published posts and moderators read all posts"
  ON public.community_posts FOR SELECT TO authenticated
  USING (moderation_status = 'published' OR public.cyberx_has_moderation_role());
GRANT SELECT (moderation_status) ON public.community_posts TO authenticated;

CREATE OR REPLACE VIEW public.community_feed WITH (security_barrier = true) AS
SELECT p.id, p.author_display_name, p.title, p.category, p.content, p.created_at, p.updated_at,
       (SELECT count(*) FROM public.community_reactions r WHERE r.post_id = p.id)::integer AS like_count,
       (SELECT count(*) FROM public.community_comments c WHERE c.post_id = p.id)::integer AS comment_count
FROM public.community_posts p
WHERE p.moderation_status = 'published';
REVOKE ALL ON public.community_feed FROM PUBLIC;
GRANT SELECT ON public.community_feed TO anon, authenticated;

ALTER TABLE private.community_write_rate_limits
  DROP CONSTRAINT community_write_rate_limits_action_check,
  ADD CONSTRAINT community_write_rate_limits_action_check
    CHECK (action IN ('post','comment','reaction','report','suggestion'));
CREATE OR REPLACE FUNCTION private.consume_community_rate_limit(
  p_user_id uuid, p_action text, p_limit integer
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
  IF p_user_id IS NULL OR p_action NOT IN ('post','comment','reaction','report','suggestion')
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
REVOKE ALL ON FUNCTION private.consume_community_rate_limit(uuid,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_display_name text NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 80),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
CREATE INDEX community_reports_status_created_idx ON public.community_reports(status, created_at);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, post_id, reporter_display_name, reason, details, status, created_at),
  INSERT (post_id, reason, details)
  ON public.community_reports TO authenticated;
CREATE POLICY "Members read own reports and moderators read report queue"
  ON public.community_reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR public.cyberx_has_moderation_role());
CREATE POLICY "Members submit reports as themselves"
  ON public.community_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT display_name INTO v_name FROM public.member_profiles WHERE user_id = auth.uid();
  IF v_name IS NULL THEN RAISE EXCEPTION 'Member profile missing' USING ERRCODE = '23503'; END IF;
  IF NOT private.consume_community_rate_limit(auth.uid(), 'report', 5) THEN
    RAISE EXCEPTION 'Community report limit reached' USING ERRCODE = 'P0001';
  END IF;
  NEW.reporter_id := auth.uid(); NEW.reporter_display_name := v_name; NEW.created_at := now(); NEW.status := 'open';
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_community_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_community_report BEFORE INSERT ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_community_report();

CREATE TABLE public.community_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 3000),
  idempotency_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','accepted','rejected','implemented')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, idempotency_key)
);
CREATE INDEX community_suggestions_status_created_idx ON public.community_suggestions(status, created_at);
ALTER TABLE public.community_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_suggestions FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, author_display_name, title, description, status, created_at, updated_at),
  INSERT (title, description, idempotency_key)
  ON public.community_suggestions TO authenticated;
CREATE POLICY "Members read own suggestions and reviewers read queue"
  ON public.community_suggestions FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()) OR public.cyberx_has_moderation_role());
CREATE POLICY "Members submit suggestions as themselves"
  ON public.community_suggestions FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT display_name INTO v_name FROM public.member_profiles WHERE user_id = auth.uid();
  IF v_name IS NULL THEN RAISE EXCEPTION 'Member profile missing' USING ERRCODE = '23503'; END IF;
  IF NOT private.consume_community_rate_limit(auth.uid(), 'suggestion', 3) THEN
    RAISE EXCEPTION 'Community suggestion limit reached' USING ERRCODE = 'P0001';
  END IF;
  NEW.author_id := auth.uid(); NEW.author_display_name := v_name;
  NEW.status := 'pending'; NEW.created_at := now(); NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_community_suggestion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_community_suggestion BEFORE INSERT ON public.community_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_community_suggestion();

CREATE TABLE private.community_moderation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('report','suggestion','post')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 40),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.community_moderation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.community_moderation_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id, actor_id, target_type, target_id, action, created_at)
  ON private.community_moderation_audit TO authenticated;
CREATE POLICY "Moderators can read immutable moderation audit"
  ON private.community_moderation_audit FOR SELECT TO authenticated
  USING (public.cyberx_has_moderation_role());

CREATE OR REPLACE FUNCTION public.cyberx_review_community_item(
  p_item_type text, p_item_id uuid, p_decision text, p_note text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE v_old_status text; v_next_status text; v_post_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT public.cyberx_has_moderation_role() THEN RAISE EXCEPTION 'Moderator role required' USING ERRCODE = '42501'; END IF;
  IF p_note IS NULL OR char_length(p_note) > 500 THEN RAISE EXCEPTION 'Invalid moderation note' USING ERRCODE = '22023'; END IF;

  IF p_item_type = 'report' THEN
    SELECT status, post_id INTO v_old_status, v_post_id FROM public.community_reports WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002'; END IF;
    IF p_decision NOT IN ('reviewed','dismissed','hide_post','remove_post') OR v_old_status <> 'open' THEN
      RAISE EXCEPTION 'Invalid report transition' USING ERRCODE = '22023';
    END IF;
    v_next_status := CASE WHEN p_decision = 'dismissed' THEN 'dismissed' ELSE 'reviewed' END;
    UPDATE public.community_reports SET status = v_next_status WHERE id = p_item_id;
    IF p_decision IN ('hide_post','remove_post') THEN
      UPDATE public.community_posts SET moderation_status = CASE WHEN p_decision = 'hide_post' THEN 'hidden' ELSE 'removed' END WHERE id = v_post_id;
      INSERT INTO private.community_moderation_audit(actor_id,target_type,target_id,action,note)
      VALUES(auth.uid(),'post',v_post_id,p_decision,p_note);
    END IF;
  ELSIF p_item_type = 'suggestion' THEN
    SELECT status INTO v_old_status FROM public.community_suggestions WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = 'P0002'; END IF;
    IF NOT ((v_old_status = 'pending' AND p_decision IN ('under_review','accepted','rejected'))
         OR (v_old_status = 'under_review' AND p_decision IN ('accepted','rejected'))
         OR (v_old_status = 'accepted' AND p_decision = 'implemented')) THEN
      RAISE EXCEPTION 'Invalid suggestion transition' USING ERRCODE = '22023';
    END IF;
    v_next_status := p_decision;
    UPDATE public.community_suggestions SET status = v_next_status, updated_at = now() WHERE id = p_item_id;
  ELSE
    RAISE EXCEPTION 'Invalid moderation item type' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.community_moderation_audit(actor_id,target_type,target_id,action,note)
  VALUES(auth.uid(),p_item_type,p_item_id,p_decision,btrim(p_note));
  RETURN v_next_status;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_review_community_item(text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyberx_review_community_item(text,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE v_user_id uuid := auth.uid(); v_display_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_user_id IS NULL OR (OLD.author_id <> v_user_id AND NOT public.cyberx_has_moderation_role()) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status AND NOT public.cyberx_has_moderation_role() THEN
      RAISE EXCEPTION 'Moderator role required' USING ERRCODE = '42501';
    END IF;
    v_user_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
  END IF;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  SELECT p.display_name INTO v_display_name FROM public.member_profiles AS p WHERE p.user_id = v_user_id;
  IF v_display_name IS NULL THEN RAISE EXCEPTION 'Member profile missing' USING ERRCODE = '23503'; END IF;
  IF TG_OP = 'INSERT' THEN NEW.moderation_status := 'published'; END IF;
  NEW.author_id := v_user_id; NEW.author_display_name := v_display_name; NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

COMMENT ON TABLE public.community_reports IS 'Private-to-reporter/moderator reports on Community posts; reporter identity is session-derived.';
COMMENT ON TABLE public.community_suggestions IS 'Member-owned suggestions; reviewers are resolved from signed app_metadata.cyberx_role.';
COMMENT ON TABLE private.community_moderation_audit IS 'Append-only audit of review actions; notes are moderator-only and never included in feed views.';
COMMENT ON FUNCTION public.cyberx_has_moderation_role() IS 'Trusted role helper; only server-issued Supabase app_metadata claims are accepted.';

COMMIT;
