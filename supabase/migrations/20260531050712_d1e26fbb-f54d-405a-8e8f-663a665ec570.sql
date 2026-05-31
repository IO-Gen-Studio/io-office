
-- Add custom jsonb to social_plans so custom fields can be stored
ALTER TABLE public.social_plans
  ADD COLUMN IF NOT EXISTS custom jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Cost versions: parent is either a project or a subscription
CREATE TABLE IF NOT EXISTS public.cost_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type text NOT NULL CHECK (parent_type IN ('project','subscription')),
  parent_id uuid NOT NULL,
  version int NOT NULL,
  label text,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_type, parent_id, version)
);
CREATE INDEX IF NOT EXISTS cost_versions_parent_idx ON public.cost_versions(parent_type, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_versions TO authenticated;
GRANT ALL ON public.cost_versions TO service_role;

ALTER TABLE public.cost_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv view" ON public.cost_versions FOR SELECT TO authenticated USING (
  (parent_type = 'project' AND has_module_access(auth.uid(), 'projects'::app_module))
  OR (parent_type = 'subscription' AND has_module_access(auth.uid(), 'subscriptions'::app_module))
);
CREATE POLICY "cv write" ON public.cost_versions FOR INSERT TO authenticated WITH CHECK (
  (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
  OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
);
CREATE POLICY "cv update" ON public.cost_versions FOR UPDATE TO authenticated USING (
  (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
  OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
);
CREATE POLICY "cv delete" ON public.cost_versions FOR DELETE TO authenticated USING (
  (parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
  OR (parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
);

-- Cost items belonging to a version
CREATE TABLE IF NOT EXISTS public.cost_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.cost_versions(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  item_no text,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  final_cost numeric NOT NULL DEFAULT 0,
  supplier_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cost_items_version_idx ON public.cost_items(version_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_items TO authenticated;
GRANT ALL ON public.cost_items TO service_role;

ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci view" ON public.cost_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cost_versions v WHERE v.id = cost_items.version_id AND (
    (v.parent_type = 'project' AND has_module_access(auth.uid(), 'projects'::app_module))
    OR (v.parent_type = 'subscription' AND has_module_access(auth.uid(), 'subscriptions'::app_module))
  ))
);
CREATE POLICY "ci write" ON public.cost_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.cost_versions v WHERE v.id = cost_items.version_id AND (
    (v.parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (v.parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  ))
);
CREATE POLICY "ci update" ON public.cost_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cost_versions v WHERE v.id = cost_items.version_id AND (
    (v.parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (v.parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  ))
);
CREATE POLICY "ci delete" ON public.cost_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cost_versions v WHERE v.id = cost_items.version_id AND (
    (v.parent_type = 'project' AND can_edit_module(auth.uid(), 'projects'::app_module))
    OR (v.parent_type = 'subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
  ))
);
