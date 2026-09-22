DROP POLICY IF EXISTS "Users read their own generated images" ON storage.objects;
CREATE POLICY "Users read their own generated images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users upload their own generated images" ON storage.objects;
CREATE POLICY "Users upload their own generated images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users delete their own generated images" ON storage.objects;
CREATE POLICY "Users delete their own generated images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "users update own generations" ON storage.objects;
CREATE POLICY "users update own generations" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "shared generation objects readable" ON storage.objects;
CREATE POLICY "shared generation objects readable" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'generations'
    AND EXISTS (
      SELECT 1 FROM public.generated_images gi
      WHERE gi.image_path = storage.objects.name AND gi.is_public = true
    )
  );

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