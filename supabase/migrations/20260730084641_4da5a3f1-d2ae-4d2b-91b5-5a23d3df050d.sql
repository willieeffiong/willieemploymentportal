ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS engineering_field text,
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET email_verified = true WHERE email_verified = false;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender text NOT NULL DEFAULT 'applicant',
  body text NOT NULL,
  read_by_admin boolean NOT NULL DEFAULT false,
  read_by_user boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "insert own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id AND sender = 'applicant') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "update own messages" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS messages_user_id_created_at_idx ON public.messages (user_id, created_at DESC);