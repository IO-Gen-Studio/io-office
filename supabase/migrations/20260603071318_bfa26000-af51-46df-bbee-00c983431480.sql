
-- 1) Storage: tenant-scoped path for project-files bucket
DROP POLICY IF EXISTS "proj files read" ON storage.objects;
DROP POLICY IF EXISTS "proj files write" ON storage.objects;
DROP POLICY IF EXISTS "proj files update" ON storage.objects;
DROP POLICY IF EXISTS "proj files delete" ON storage.objects;

CREATE POLICY "proj files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-files'
  AND has_module_access(auth.uid(), 'projects'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "proj files write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND can_edit_module(auth.uid(), 'projects'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "proj files update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-files'
  AND can_edit_module(auth.uid(), 'projects'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
)
WITH CHECK (
  bucket_id = 'project-files'
  AND can_edit_module(auth.uid(), 'projects'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "proj files delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-files'
  AND can_edit_module(auth.uid(), 'projects'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

-- 2) Storage: tenant-scoped path for social-media bucket
DROP POLICY IF EXISTS "social auth list" ON storage.objects;
DROP POLICY IF EXISTS "social auth write" ON storage.objects;
DROP POLICY IF EXISTS "social auth update" ON storage.objects;
DROP POLICY IF EXISTS "social auth delete" ON storage.objects;

CREATE POLICY "social auth list" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'social-media'
  AND has_module_access(auth.uid(), 'social'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "social auth write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'social-media'
  AND can_edit_module(auth.uid(), 'social'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "social auth update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'social-media'
  AND can_edit_module(auth.uid(), 'social'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
)
WITH CHECK (
  bucket_id = 'social-media'
  AND can_edit_module(auth.uid(), 'social'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "social auth delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'social-media'
  AND can_edit_module(auth.uid(), 'social'::app_module)
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

-- 3) Profiles: tighten self-update so active_tenant_id can only be set to a tenant the user belongs to
DROP POLICY IF EXISTS "profiles self update safe" ON public.profiles;

CREATE POLICY "profiles self update safe" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND active = public.is_active(auth.uid())
  AND must_change_password = public.profile_must_change_password(auth.uid())
  AND (
    active_tenant_id IS NULL
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.tenant_id = active_tenant_id
    )
  )
);

-- 4) Allow service role to delete from email_send_log and suppressed_emails for maintenance
CREATE POLICY "Service role can delete send log" ON public.email_send_log FOR DELETE TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete suppressed emails" ON public.suppressed_emails FOR DELETE TO public
USING (auth.role() = 'service_role');
