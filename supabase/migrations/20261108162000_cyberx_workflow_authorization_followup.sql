-- M8 corrective follow-up: expose the member-owned completion timestamp,
-- and add explicit report-driven hide/remove/restore moderation transitions.
BEGIN;

GRANT SELECT (completed_at) ON public.learning_progress TO authenticated;

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
  ELSIF p_item_type = 'post' THEN
    SELECT moderation_status INTO v_old_status FROM public.community_posts WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0002'; END IF;
    IF NOT ((v_old_status = 'published' AND p_decision IN ('hide','remove'))
         OR (v_old_status = 'hidden' AND p_decision IN ('restore','remove'))) THEN
      RAISE EXCEPTION 'Invalid post moderation transition' USING ERRCODE = '22023';
    END IF;
    v_next_status := CASE p_decision WHEN 'hide' THEN 'hidden' WHEN 'remove' THEN 'removed' ELSE 'published' END;
    UPDATE public.community_posts SET moderation_status = v_next_status WHERE id = p_item_id;
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

COMMIT;
