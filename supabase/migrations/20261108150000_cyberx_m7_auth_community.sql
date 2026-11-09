-- M7: private member profiles and a public, text-only Community feed.
-- All writes require a verified Supabase Auth session. Identity/display values
-- are derived in database triggers; browser-supplied author IDs are ignored.
BEGIN;

CREATE TABLE public.member_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 48),
  handle text NOT NULL CHECK (char_length(btrim(handle)) BETWEEN 1 AND 32),
  headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 64),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, display_name, handle, headline, bio, created_at, updated_at),
  UPDATE (display_name, handle, headline, bio)
  ON public.member_profiles TO authenticated;
CREATE POLICY "Members can read their own profile" ON public.member_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update their own profile" ON public.member_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.cyberx_create_member_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_display_name text := btrim(COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''));
  v_handle text := btrim(COALESCE(NEW.raw_user_meta_data ->> 'handle', ''));
BEGIN
  IF char_length(v_display_name) NOT BETWEEN 1 AND 48
     OR char_length(v_handle) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'Invalid profile metadata' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.member_profiles (user_id, display_name, handle)
  VALUES (NEW.id, v_display_name, v_handle);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_create_member_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cyberx_create_member_profile() TO supabase_auth_admin;
DROP TRIGGER IF EXISTS cyberx_create_member_profile ON auth.users;
CREATE TRIGGER cyberx_create_member_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_create_member_profile();

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN (
    'General Discussion', 'SOC & Blue Team', 'DFIR', 'Malware Analysis',
    'Web Security', 'Career & Opportunities'
  )),
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_created_at_idx ON public.community_posts (created_at DESC, id DESC);
CREATE INDEX community_posts_author_created_idx ON public.community_posts (author_id, created_at DESC);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, author_display_name, title, category, content, created_at, updated_at),
  INSERT (title, category, content),
  UPDATE (title, category, content), DELETE
  ON public.community_posts TO authenticated;
CREATE POLICY "Signed-in members can read posts" ON public.community_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can create their own posts" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));
CREATE POLICY "Members can update their own posts" ON public.community_posts
  FOR UPDATE TO authenticated USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));
CREATE POLICY "Members can delete their own posts" ON public.community_posts
  FOR DELETE TO authenticated USING (author_id = (SELECT auth.uid()));

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
  NEW.author_id := v_user_id;
  NEW.author_display_name := v_display_name;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_community_post() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_community_post
  BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_community_post();

CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_post_created_idx ON public.community_comments (post_id, created_at, id);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, post_id, author_display_name, content, created_at),
  INSERT (post_id, content), DELETE
  ON public.community_comments TO authenticated;
CREATE POLICY "Signed-in members can read comments" ON public.community_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can create their own comments" ON public.community_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));
CREATE POLICY "Members can delete their own comments" ON public.community_comments
  FOR DELETE TO authenticated USING (author_id = (SELECT auth.uid()));

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
  NEW.author_id := v_user_id;
  NEW.author_display_name := v_display_name;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_community_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_community_comment
  BEFORE INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_community_comment();

CREATE TABLE public.community_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT (post_id, user_id), INSERT (post_id), DELETE ON public.community_reactions TO authenticated;
CREATE POLICY "Members can read their own reactions" ON public.community_reactions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Members can react as themselves" ON public.community_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Members can remove their own reactions" ON public.community_reactions
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.cyberx_guard_community_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.cyberx_guard_community_reaction() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cyberx_guard_community_reaction
  BEFORE INSERT ON public.community_reactions
  FOR EACH ROW EXECUTE FUNCTION public.cyberx_guard_community_reaction();

CREATE OR REPLACE VIEW public.community_feed WITH (security_barrier = true) AS
SELECT p.id, p.author_display_name, p.title, p.category, p.content, p.created_at, p.updated_at,
       (SELECT count(*) FROM public.community_reactions r WHERE r.post_id = p.id)::integer AS like_count,
       (SELECT count(*) FROM public.community_comments c WHERE c.post_id = p.id)::integer AS comment_count
FROM public.community_posts p;
CREATE OR REPLACE VIEW public.community_comment_feed WITH (security_barrier = true) AS
SELECT c.id, c.post_id, c.author_display_name, c.content, c.created_at
FROM public.community_comments c;
REVOKE ALL ON public.community_feed, public.community_comment_feed FROM PUBLIC;
GRANT SELECT ON public.community_feed, public.community_comment_feed TO anon, authenticated;

COMMENT ON TABLE public.member_profiles IS 'Private member-owned profile fields. No email, role, or admin claim is stored here.';
COMMENT ON TABLE public.community_posts IS 'Public text-only Community posts; author identity and display name are assigned from the authenticated session.';
COMMENT ON TABLE public.community_comments IS 'Public text-only comments; author identity and display name are assigned from the authenticated session.';
COMMENT ON TABLE public.community_reactions IS 'One authenticated like per member/post; aggregate counts are exposed through community_feed.';
COMMENT ON VIEW public.community_feed IS 'Public-safe Community feed view; omits auth user IDs and exposes no direct write path.';
COMMENT ON VIEW public.community_comment_feed IS 'Public-safe Community comments view; omits auth user IDs and exposes no direct write path.';

COMMIT;
