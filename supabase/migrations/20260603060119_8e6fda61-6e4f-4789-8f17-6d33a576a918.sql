CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_must_change_password(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT must_change_password FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.profile_active_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_tenant_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.cost_version_in_current_tenant(_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cost_versions
    WHERE id = _version_id
      AND tenant_id = public.current_tenant_id()
  )
$$;

DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'activity_log',
    'assignments',
    'builtin_field_labels',
    'campaign_contacts',
    'campaign_templates',
    'campaigns',
    'contacts',
    'cost_versions',
    'custom_field_defs',
    'email_templates',
    'events',
    'gmail_connections',
    'lead_status_options',
    'milestone_templates',
    'milestones',
    'module_access',
    'notifications',
    'organisations',
    'outreach_status_options',
    'projects',
    'social_plans',
    'subscription_plan_options',
    'subscriptions'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || ' tenant isolation select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || ' tenant isolation insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || ' tenant isolation update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || ' tenant isolation delete', table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())',
      table_name || ' tenant isolation select', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id())',
      table_name || ' tenant isolation insert', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      table_name || ' tenant isolation update', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id())',
      table_name || ' tenant isolation delete', table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "cost_items tenant isolation select" ON public.cost_items;
DROP POLICY IF EXISTS "cost_items tenant isolation insert" ON public.cost_items;
DROP POLICY IF EXISTS "cost_items tenant isolation update" ON public.cost_items;
DROP POLICY IF EXISTS "cost_items tenant isolation delete" ON public.cost_items;

CREATE POLICY "cost_items tenant isolation select"
ON public.cost_items
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.cost_version_in_current_tenant(version_id));

CREATE POLICY "cost_items tenant isolation insert"
ON public.cost_items
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.cost_version_in_current_tenant(version_id));

CREATE POLICY "cost_items tenant isolation update"
ON public.cost_items
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.cost_version_in_current_tenant(version_id))
WITH CHECK (public.cost_version_in_current_tenant(version_id));

CREATE POLICY "cost_items tenant isolation delete"
ON public.cost_items
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.cost_version_in_current_tenant(version_id));

DROP POLICY IF EXISTS "profiles read all" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin all" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update safe" ON public.profiles;
DROP POLICY IF EXISTS "profiles read scoped" ON public.profiles;

CREATE POLICY "profiles read scoped"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_tenant_member(id, public.current_tenant_id())
);

CREATE POLICY "profiles self update safe"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND active = public.is_active(auth.uid())
  AND must_change_password = public.profile_must_change_password(auth.uid())
  AND active_tenant_id IS NOT DISTINCT FROM public.profile_active_tenant_id(auth.uid())
);