ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS post_id uuid;

CREATE TABLE IF NOT EXISTS public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage their own post views" ON public.post_views FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS extra_ai_base_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS extra_ai_model text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS extra_ai_key text;