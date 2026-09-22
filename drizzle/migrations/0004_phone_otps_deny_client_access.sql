DROP POLICY IF EXISTS "phone otps deny client access" ON public.phone_otps;
CREATE POLICY "phone otps deny client access" ON public.phone_otps
  FOR ALL TO authenticated USING (false) WITH CHECK (false);