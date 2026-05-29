
-- Admin-managed module_access
CREATE POLICY "module_access admin write" ON public.module_access
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "module_access admin update" ON public.module_access
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "module_access admin delete" ON public.module_access
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin-managed user_roles
CREATE POLICY "user_roles admin write" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles admin delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Gmail connections: per-user only
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gmail own all" ON public.gmail_connections
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_connections TO authenticated;
GRANT ALL ON public.gmail_connections TO service_role;
