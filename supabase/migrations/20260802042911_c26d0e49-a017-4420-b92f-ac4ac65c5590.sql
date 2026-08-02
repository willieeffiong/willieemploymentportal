CREATE POLICY "chat uploads own folder insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat uploads own folder select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "post media admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "post media admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND public.has_role(auth.uid(), 'admin'));