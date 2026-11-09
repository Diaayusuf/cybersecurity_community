-- Create a private, non-email profile for pre-existing Auth users as well as
-- new users handled by the signup trigger. Existing profile rows are untouched.
BEGIN;
INSERT INTO public.member_profiles (user_id, display_name, handle)
SELECT u.id,
  CASE
    WHEN char_length(btrim(COALESCE(u.raw_user_meta_data ->> 'display_name', ''))) BETWEEN 1 AND 48
      THEN btrim(u.raw_user_meta_data ->> 'display_name')
    ELSE 'CyberX member'
  END,
  CASE
    WHEN char_length(btrim(COALESCE(u.raw_user_meta_data ->> 'handle', ''))) BETWEEN 1 AND 32
      THEN btrim(u.raw_user_meta_data ->> 'handle')
    ELSE 'member-' || left(replace(u.id::text, '-', ''), 12)
  END
FROM auth.users AS u
ON CONFLICT (user_id) DO NOTHING;
COMMIT;
