-- Login / security audit trail
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  provider TEXT,
  user_agent TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own auth events select" ON public.auth_events;
CREATE POLICY "own auth events select" ON public.auth_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own auth events insert" ON public.auth_events;
CREATE POLICY "own auth events insert" ON public.auth_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own auth events delete" ON public.auth_events;
CREATE POLICY "own auth events delete" ON public.auth_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS auth_events_user_created_idx ON public.auth_events (user_id, created_at DESC);

-- Personal API keys (only the hash is stored)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own api keys" ON public.api_keys;
CREATE POLICY "own api keys" ON public.api_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Community gallery
ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS generated_images_public_idx ON public.generated_images (is_public, created_at DESC);

DROP POLICY IF EXISTS "public images are readable" ON public.generated_images;
CREATE POLICY "public images are readable" ON public.generated_images
  FOR SELECT TO authenticated USING (is_public = true);

DROP POLICY IF EXISTS "shared generation objects readable" ON storage.objects;
CREATE POLICY "shared generation objects readable" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'generations'
    AND EXISTS (
      SELECT 1 FROM public.generated_images gi
      WHERE gi.image_path = storage.objects.name AND gi.is_public = true
    )
  );

-- Phone + country on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, phone)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone')
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- One-time verification codes (server only)
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps (phone, created_at DESC);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- Avatar storage: each user owns a folder named after their id
DROP POLICY IF EXISTS "users read own avatars" ON storage.objects;
CREATE POLICY "users read own avatars" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "users upload own avatars" ON storage.objects;
CREATE POLICY "users upload own avatars" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "users update own avatars" ON storage.objects;
CREATE POLICY "users update own avatars" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "users delete own avatars" ON storage.objects;
CREATE POLICY "users delete own avatars" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "users update own generations" ON storage.objects;
CREATE POLICY "users update own generations" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Harden internal helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;