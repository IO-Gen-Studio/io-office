
-- 1. Profile self-update column guard
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update safe" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND active = (SELECT p.active FROM public.profiles p WHERE p.id = auth.uid())
    AND must_change_password = (SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2. Enforce profile.active in access functions (server-side revocation)
CREATE OR REPLACE FUNCTION public.is_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT active FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active(_user_id)
     AND (public.is_admin(_user_id)
       OR EXISTS (SELECT 1 FROM public.module_access WHERE user_id = _user_id AND module = _module AND can_view))
$$;

CREATE OR REPLACE FUNCTION public.can_edit_module(_user_id uuid, _module app_module)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active(_user_id)
     AND (public.is_admin(_user_id)
       OR EXISTS (SELECT 1 FROM public.module_access WHERE user_id = _user_id AND module = _module AND can_edit))
$$;

-- 3. Assignments ownership
DROP POLICY IF EXISTS "assignments write" ON public.assignments;
DROP POLICY IF EXISTS "assignments delete" ON public.assignments;
CREATE POLICY "assignments write" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "assignments delete" ON public.assignments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 4. Storage policies: path-scoped
-- Avatars: writes/updates restricted to user's own folder
DROP POLICY IF EXISTS "avatars auth write" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth update" ON storage.objects;
CREATE POLICY "avatars auth write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "avatars auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "avatars auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Social media: scoped to users with edit access to social module
DROP POLICY IF EXISTS "social auth write" ON storage.objects;
DROP POLICY IF EXISTS "social auth update" ON storage.objects;
DROP POLICY IF EXISTS "social auth delete" ON storage.objects;
CREATE POLICY "social auth write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND public.can_edit_module(auth.uid(), 'social'::app_module)
  );
CREATE POLICY "social auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND public.can_edit_module(auth.uid(), 'social'::app_module)
  );
CREATE POLICY "social auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND public.can_edit_module(auth.uid(), 'social'::app_module)
  );
