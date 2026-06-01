
-- 1. Lock down queue helper functions (revoke from anon/authenticated, add search_path)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- log_activity is called from server contexts; restrict to authenticated only (already had search_path).
REVOKE EXECUTE ON FUNCTION public.log_activity(app_module, text, uuid, text, text, jsonb) FROM PUBLIC, anon;

-- handle_new_user is a trigger function on auth.users; not directly callable, but lock down to be safe.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- set_updated_at has no fixed search_path; fix it.
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 2. activity_log: require module access to insert
DROP POLICY IF EXISTS "activity_log insert" ON public.activity_log;
CREATE POLICY "activity_log insert" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.has_module_access(auth.uid(), module));

-- 3. assignments: add UPDATE policy so user_id can't be reassigned
CREATE POLICY "assignments update" ON public.assignments
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK ((user_id = auth.uid()) OR public.is_admin(auth.uid()));

-- 4. events: restrict UPDATE to creator/admin
DROP POLICY IF EXISTS "events update" ON public.events;
CREATE POLICY "events update" ON public.events
  FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.is_admin(auth.uid()));

-- 5. storage: restrict listing of public buckets to authenticated users (public URL access still works)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars auth list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "social public read" ON storage.objects;
CREATE POLICY "social auth list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'social-media' AND public.has_module_access(auth.uid(), 'social'::public.app_module));

-- 6. storage: scope project-files to projects-module members
DROP POLICY IF EXISTS "proj files auth read" ON storage.objects;
DROP POLICY IF EXISTS "proj files auth write" ON storage.objects;
DROP POLICY IF EXISTS "proj files auth update" ON storage.objects;
DROP POLICY IF EXISTS "proj files auth delete" ON storage.objects;

CREATE POLICY "proj files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND public.has_module_access(auth.uid(), 'projects'::public.app_module));

CREATE POLICY "proj files write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.can_edit_module(auth.uid(), 'projects'::public.app_module));

CREATE POLICY "proj files update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND public.can_edit_module(auth.uid(), 'projects'::public.app_module))
  WITH CHECK (bucket_id = 'project-files' AND public.can_edit_module(auth.uid(), 'projects'::public.app_module));

CREATE POLICY "proj files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND public.can_edit_module(auth.uid(), 'projects'::public.app_module));
