
GRANT INSERT, UPDATE, DELETE ON public.custom_field_defs TO authenticated;

CREATE POLICY "cfd admin write" ON public.custom_field_defs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cfd admin update" ON public.custom_field_defs
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cfd admin delete" ON public.custom_field_defs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
