-- Fix: activity_log cross-module leakage — scope reads by module access
DROP POLICY IF EXISTS "activity_log read" ON public.activity_log;
CREATE POLICY "activity_log read" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), module));

-- Fix: SECURITY DEFINER helpers exposed to anon via PostgREST RPC.
-- Authenticated must retain EXECUTE because these are invoked inside RLS policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, public.app_module) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_module(uuid, public.app_module) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;