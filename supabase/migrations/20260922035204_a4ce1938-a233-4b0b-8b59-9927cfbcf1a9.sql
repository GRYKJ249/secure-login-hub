DROP POLICY IF EXISTS "phone otps deny client access" ON public.phone_otps;
CREATE POLICY "phone otps deny client access" ON public.phone_otps
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users update their own images" ON public.generated_images;
CREATE POLICY "Users update their own images" ON public.generated_images
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;