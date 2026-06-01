CREATE TABLE public.builtin_field_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module app_module NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, field_key, value)
);

GRANT SELECT ON public.builtin_field_labels TO authenticated;
GRANT ALL ON public.builtin_field_labels TO service_role;

ALTER TABLE public.builtin_field_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bfl read" ON public.builtin_field_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "bfl admin write" ON public.builtin_field_labels FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "bfl admin update" ON public.builtin_field_labels FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "bfl admin delete" ON public.builtin_field_labels FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER bfl_updated_at BEFORE UPDATE ON public.builtin_field_labels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();