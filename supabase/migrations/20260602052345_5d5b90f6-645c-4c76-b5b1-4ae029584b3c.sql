
-- Add Eventbrite to social platforms
ALTER TYPE public.social_platform ADD VALUE IF NOT EXISTS 'eventbrite';

-- Subscription plan options (user-managed dropdown)
CREATE TABLE IF NOT EXISTS public.subscription_plan_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_options TO authenticated;
GRANT ALL ON public.subscription_plan_options TO service_role;

ALTER TABLE public.subscription_plan_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spo read" ON public.subscription_plan_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "spo admin write" ON public.subscription_plan_options
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "spo admin update" ON public.subscription_plan_options
  FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "spo admin delete" ON public.subscription_plan_options
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Seed existing distinct plan names as options
INSERT INTO public.subscription_plan_options (label, position)
SELECT plan_name, row_number() OVER (ORDER BY plan_name) - 1
FROM (SELECT DISTINCT plan_name FROM public.subscriptions WHERE plan_name IS NOT NULL AND plan_name <> '') s
ON CONFLICT (label) DO NOTHING;
