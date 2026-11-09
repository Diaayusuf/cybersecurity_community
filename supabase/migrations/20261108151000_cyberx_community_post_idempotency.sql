-- Add database-backed duplicate-submit protection without rewriting applied M7 history.
BEGIN;
ALTER TABLE public.community_posts
  ADD COLUMN idempotency_key uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_author_request_key UNIQUE (author_id, idempotency_key);
GRANT INSERT (idempotency_key) ON public.community_posts TO authenticated;
COMMENT ON COLUMN public.community_posts.idempotency_key IS 'Client-generated per-submit UUID; scoped to the authenticated author by a unique constraint.';
COMMIT;
