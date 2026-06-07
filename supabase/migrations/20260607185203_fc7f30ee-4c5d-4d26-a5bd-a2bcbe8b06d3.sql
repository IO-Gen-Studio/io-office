CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id(),
  parent_type text NOT NULL CHECK (parent_type IN ('project','subscription')),
  parent_id uuid NOT NULL,
  title text NOT NULL,
  assignee_id uuid,
  due_date date,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos view" ON public.todos FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND (
  (parent_type='project' AND has_module_access(auth.uid(), 'projects'::app_module)) OR
  (parent_type='subscription' AND has_module_access(auth.uid(), 'subscriptions'::app_module))
)));

CREATE POLICY "todos insert" ON public.todos FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND (
  (parent_type='project' AND can_edit_module(auth.uid(), 'projects'::app_module)) OR
  (parent_type='subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
)));

CREATE POLICY "todos update" ON public.todos FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND (
  (parent_type='project' AND can_edit_module(auth.uid(), 'projects'::app_module)) OR
  (parent_type='subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
)));

CREATE POLICY "todos delete" ON public.todos FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id() AND (
  (parent_type='project' AND can_edit_module(auth.uid(), 'projects'::app_module)) OR
  (parent_type='subscription' AND can_edit_module(auth.uid(), 'subscriptions'::app_module))
)));

CREATE TRIGGER todos_set_updated_at BEFORE UPDATE ON public.todos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX todos_parent_idx ON public.todos(parent_type, parent_id);