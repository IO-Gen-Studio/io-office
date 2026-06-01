
-- 1) milestone_templates: add module + project_type, admin write policies
ALTER TABLE public.milestone_templates
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'projects',
  ADD COLUMN IF NOT EXISTS project_type text;

-- Admin policies (read policy already exists)
DROP POLICY IF EXISTS "mt admin write" ON public.milestone_templates;
DROP POLICY IF EXISTS "mt admin update" ON public.milestone_templates;
DROP POLICY IF EXISTS "mt admin delete" ON public.milestone_templates;

CREATE POLICY "mt admin write" ON public.milestone_templates
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "mt admin update" ON public.milestone_templates
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "mt admin delete" ON public.milestone_templates
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestone_templates TO authenticated;
GRANT ALL ON public.milestone_templates TO service_role;

-- 2) Seed subscription milestone templates (only if none exist for subscriptions)
INSERT INTO public.milestone_templates (label, position, module, project_type)
SELECT v.label, v.position, 'subscriptions', NULL
FROM (VALUES
  ('Initial enquiry', 1),
  ('Cost proposal submitted', 2),
  ('Order approved', 3),
  ('Order received', 4),
  ('LoA signed', 5),
  ('Data configured', 6),
  ('Live on io-gen & user login sent', 7),
  ('Invoiced', 8)
) AS v(label, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.milestone_templates WHERE module = 'subscriptions'
);

-- 3) milestones: add parent_type + parent_id, backfill, relax project_id
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS parent_type text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS parent_id uuid;

UPDATE public.milestones SET parent_id = project_id WHERE parent_id IS NULL;

ALTER TABLE public.milestones ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS milestones_parent_idx ON public.milestones (parent_type, parent_id, position);

-- 4) RLS: expand milestone policies to cover subscription parents too
DROP POLICY IF EXISTS "ms view" ON public.milestones;
DROP POLICY IF EXISTS "ms write" ON public.milestones;
DROP POLICY IF EXISTS "ms update" ON public.milestones;
DROP POLICY IF EXISTS "ms delete" ON public.milestones;

CREATE POLICY "ms view" ON public.milestones FOR SELECT TO authenticated
  USING (
    (parent_type = 'project' AND has_module_access(auth.uid(), 'projects'::app_module))
    OR (parent_type = 'subscription' AND has_module_access(auth.uid(), 'subscriptions'::app_module))
  );
CREATE POLICY "ms write" ON public.milestones FOR INSERT TO authenticated
  WITH CHECK (
    (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  );
CREATE POLICY "ms update" ON public.milestones FOR UPDATE TO authenticated
  USING (
    (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  );
CREATE POLICY "ms delete" ON public.milestones FOR DELETE TO authenticated
  USING (
    (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  );
