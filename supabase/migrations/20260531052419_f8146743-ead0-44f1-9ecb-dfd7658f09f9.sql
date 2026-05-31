CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time text,
  end_time text,
  location text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events read" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events insert" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events update" ON public.events FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "events delete" ON public.events FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_admin(auth.uid()));

CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();