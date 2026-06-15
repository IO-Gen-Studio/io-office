CREATE OR REPLACE FUNCTION public.seed_issue_columns_for_tenant(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.issue_column_defs (tenant_id, key, label, type, options, position, is_builtin, is_active)
  VALUES
    (_tenant_id, 'issue_number', 'Task ID', 'number', '[]'::jsonb, 0, true, true),
    (_tenant_id, 'task', 'Task', 'long_text', '[]'::jsonb, 1, true, true),
    (_tenant_id, 'issue_date', 'Date', 'date', '[]'::jsonb, 2, true, true),
    (_tenant_id, 'priority', 'Priority', 'dropdown', '["H","M","L"]'::jsonb, 3, true, true),
    (_tenant_id, 'owner_id', 'Owner', 'reference', '{"target":"profiles"}'::jsonb, 4, true, true),
    (_tenant_id, 'status', 'Status', 'dropdown', '["Open","In Progress","Resolved","Closed"]'::jsonb, 5, true, true),
    (_tenant_id, 'comment', 'Comment', 'long_text', '[]'::jsonb, 6, true, true)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_issue_columns_for_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_issue_columns_for_tenant(uuid) TO service_role;

DO $$
DECLARE tenant_record record;
BEGIN
  FOR tenant_record IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_issue_columns_for_tenant(tenant_record.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_issue_columns_after_tenant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_issue_columns_for_tenant(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_issue_columns_after_tenant_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_issue_columns_after_tenant_insert() TO service_role;

DROP TRIGGER IF EXISTS seed_issue_columns_on_tenant_insert ON public.tenants;
CREATE TRIGGER seed_issue_columns_on_tenant_insert
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.seed_issue_columns_after_tenant_insert();