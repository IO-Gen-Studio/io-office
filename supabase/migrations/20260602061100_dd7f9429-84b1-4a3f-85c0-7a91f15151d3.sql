
-- =========================================================================
-- 1. TENANTS & MEMBERSHIP
-- =========================================================================

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. HELPER FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id=_user_id AND tenant_id=_tenant_id)
$$;

-- profiles.active_tenant_id added below; current_tenant_id reads it
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tenant_id uuid;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT active_tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- =========================================================================
-- 3. DEFAULT TENANT + BACKFILL
-- =========================================================================

INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-00000000a001', 'IO-Gen', 'io-gen');

-- Promote Jed to super admin
INSERT INTO public.super_admins (user_id)
VALUES ('40626fa9-c64a-4d98-8535-d2504712e02d')
ON CONFLICT DO NOTHING;

-- Add every existing user to IO-Gen tenant; first existing admin becomes owner
INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-00000000a001', p.id,
       CASE WHEN public.is_admin(p.id) THEN 'owner' ELSE 'member' END
FROM public.profiles p
ON CONFLICT DO NOTHING;

-- Set active tenant for all users
UPDATE public.profiles SET active_tenant_id = '00000000-0000-0000-0000-00000000a001'
WHERE active_tenant_id IS NULL;

-- =========================================================================
-- 4. ADD tenant_id TO ALL TENANT-SCOPED TABLES + BACKFILL + NOT NULL + FK
-- =========================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'contacts','organisations','projects','subscriptions',
    'campaigns','campaign_contacts','campaign_templates',
    'email_templates','social_plans','events','milestones',
    'cost_versions','milestone_templates','custom_field_defs',
    'builtin_field_labels','subscription_plan_options',
    'lead_status_options','outreach_status_options',
    'activity_log','notifications','assignments','gmail_connections',
    'module_access'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL',
                   t, '00000000-0000-0000-0000-00000000a001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE',
                   t, t || '_tenant_fk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)',
                   'idx_' || t || '_tenant', t);
  END LOOP;
END $$;

-- module_access uniqueness now per-tenant
ALTER TABLE public.module_access
  ADD CONSTRAINT module_access_user_tenant_module_unique
  UNIQUE (user_id, tenant_id, module);

-- =========================================================================
-- 5. UPDATE MODULE ACCESS HELPERS TO BE TENANT-AWARE
-- =========================================================================

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active(_user_id) AND (
    public.is_super_admin(_user_id)
    OR public.is_admin(_user_id) -- legacy tenant-admin
    OR EXISTS (
      SELECT 1 FROM public.module_access ma
      WHERE ma.user_id = _user_id
        AND ma.module = _module
        AND ma.can_view
        AND ma.tenant_id = public.current_tenant_id()
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_module(_user_id uuid, _module app_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active(_user_id) AND (
    public.is_super_admin(_user_id)
    OR public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.module_access ma
      WHERE ma.user_id = _user_id
        AND ma.module = _module
        AND ma.can_edit
        AND ma.tenant_id = public.current_tenant_id()
    )
  )
$$;

-- =========================================================================
-- 6. RLS POLICIES FOR NEW TABLES
-- =========================================================================

CREATE POLICY "tenants read" ON public.tenants FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
       OR EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=tenants.id AND user_id=auth.uid()));
CREATE POLICY "tenants super write" ON public.tenants FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "tenants super update" ON public.tenants FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "tenants super delete" ON public.tenants FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "tm read" ON public.tenant_members FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.tenant_members tm2
                  WHERE tm2.tenant_id=tenant_members.tenant_id AND tm2.user_id=auth.uid() AND tm2.role='owner'));
CREATE POLICY "tm super write" ON public.tenant_members FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "tm super update" ON public.tenant_members FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "tm super delete" ON public.tenant_members FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "sa read" ON public.super_admins FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "sa super write" ON public.super_admins FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "sa super delete" ON public.super_admins FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

-- =========================================================================
-- 7. REWRITE RLS ON TENANT-SCOPED TABLES
--    Pattern: super_admin bypass OR (tenant matches active AND module access)
-- =========================================================================

DO $$
DECLARE
  spec record;
  policies text[];
  pol text;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('contacts','crm'),
    ('organisations','crm'),
    ('projects','projects'),
    ('subscriptions','subscriptions'),
    ('campaigns','outreach'),
    ('campaign_contacts','outreach'),
    ('campaign_templates','outreach'),
    ('email_templates','outreach'),
    ('social_plans','social')
  ) AS s(tbl, modname)
  LOOP
    -- drop existing policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=spec.tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, spec.tbl);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "%s view" ON public.%I FOR SELECT TO authenticated
      USING (public.is_super_admin(auth.uid())
             OR (tenant_id = public.current_tenant_id()
                 AND public.has_module_access(auth.uid(), %L)))
    $f$, spec.tbl, spec.tbl, spec.modname);

    EXECUTE format($f$
      CREATE POLICY "%s write" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.is_super_admin(auth.uid())
                  OR (tenant_id = public.current_tenant_id()
                      AND public.can_edit_module(auth.uid(), %L)))
    $f$, spec.tbl, spec.tbl, spec.modname);

    EXECUTE format($f$
      CREATE POLICY "%s update" ON public.%I FOR UPDATE TO authenticated
      USING (public.is_super_admin(auth.uid())
             OR (tenant_id = public.current_tenant_id()
                 AND public.can_edit_module(auth.uid(), %L)))
    $f$, spec.tbl, spec.tbl, spec.modname);

    EXECUTE format($f$
      CREATE POLICY "%s delete" ON public.%I FOR DELETE TO authenticated
      USING (public.is_super_admin(auth.uid())
             OR (tenant_id = public.current_tenant_id()
                 AND public.can_edit_module(auth.uid(), %L)))
    $f$, spec.tbl, spec.tbl, spec.modname);
  END LOOP;
END $$;

-- Milestones / cost_versions (dual-module)
DROP POLICY IF EXISTS "ms view" ON public.milestones;
DROP POLICY IF EXISTS "ms write" ON public.milestones;
DROP POLICY IF EXISTS "ms update" ON public.milestones;
DROP POLICY IF EXISTS "ms delete" ON public.milestones;

CREATE POLICY "ms view" ON public.milestones FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.has_module_access(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.has_module_access(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "ms write" ON public.milestones FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "ms update" ON public.milestones FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "ms delete" ON public.milestones FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));

DROP POLICY IF EXISTS "cv view" ON public.cost_versions;
DROP POLICY IF EXISTS "cv write" ON public.cost_versions;
DROP POLICY IF EXISTS "cv update" ON public.cost_versions;
DROP POLICY IF EXISTS "cv delete" ON public.cost_versions;

CREATE POLICY "cv view" ON public.cost_versions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.has_module_access(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.has_module_access(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "cv write" ON public.cost_versions FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "cv update" ON public.cost_versions FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));
CREATE POLICY "cv delete" ON public.cost_versions FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (
    (parent_type='project' AND public.can_edit_module(auth.uid(),'projects'))
    OR (parent_type='subscription' AND public.can_edit_module(auth.uid(),'subscriptions'))
  )));

-- Events (calendar, no module gating beyond tenant)
DROP POLICY IF EXISTS "events read" ON public.events;
DROP POLICY IF EXISTS "events insert" ON public.events;
DROP POLICY IF EXISTS "events update" ON public.events;
DROP POLICY IF EXISTS "events delete" ON public.events;

CREATE POLICY "events read" ON public.events FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "events insert" ON public.events FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "events update" ON public.events FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "events delete" ON public.events FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid()))));

-- Activity log
DROP POLICY IF EXISTS "activity_log read" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log insert" ON public.activity_log;
CREATE POLICY "activity_log read" ON public.activity_log FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND public.has_module_access(auth.uid(), module)));
CREATE POLICY "activity_log insert" ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid())
  OR (actor_id = auth.uid() AND tenant_id = public.current_tenant_id() AND public.has_module_access(auth.uid(), module)));

-- Notifications
DROP POLICY IF EXISTS "notifications own" ON public.notifications;
CREATE POLICY "notifications own" ON public.notifications FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (user_id = auth.uid() AND tenant_id = public.current_tenant_id()))
WITH CHECK (public.is_super_admin(auth.uid()) OR (user_id = auth.uid() AND tenant_id = public.current_tenant_id()));

-- Assignments
DROP POLICY IF EXISTS "assignments read" ON public.assignments;
DROP POLICY IF EXISTS "assignments write" ON public.assignments;
DROP POLICY IF EXISTS "assignments update" ON public.assignments;
DROP POLICY IF EXISTS "assignments delete" ON public.assignments;
CREATE POLICY "assignments read" ON public.assignments FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "assignments write" ON public.assignments FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "assignments update" ON public.assignments FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_admin(auth.uid()))))
WITH CHECK (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "assignments delete" ON public.assignments FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_admin(auth.uid()))));

-- Per-tenant settings tables: read by tenant members, admin writes
DO $$
DECLARE tbl text; tables text[] := ARRAY['milestone_templates','custom_field_defs','builtin_field_labels','subscription_plan_options','lead_status_options','outreach_status_options'];
DECLARE pol text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;
    EXECUTE format($f$
      CREATE POLICY "%s read" ON public.%I FOR SELECT TO authenticated
      USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
    $f$, tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY "%s admin write" ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid()))
        AND (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id()))
    $f$, tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY "%s admin update" ON public.%I FOR UPDATE TO authenticated
      USING (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()))
      WITH CHECK (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()))
    $f$, tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY "%s admin delete" ON public.%I FOR DELETE TO authenticated
      USING (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()))
    $f$, tbl, tbl);
  END LOOP;
END $$;

-- module_access: admin-managed per tenant
DROP POLICY IF EXISTS "module_access self read" ON public.module_access;
DROP POLICY IF EXISTS "module_access admin write" ON public.module_access;
DROP POLICY IF EXISTS "module_access admin update" ON public.module_access;
DROP POLICY IF EXISTS "module_access admin delete" ON public.module_access;
CREATE POLICY "module_access read" ON public.module_access FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()));
CREATE POLICY "module_access write" ON public.module_access FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid())
  OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()));
CREATE POLICY "module_access update" ON public.module_access FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()));
CREATE POLICY "module_access delete" ON public.module_access FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.is_admin(auth.uid()) AND tenant_id = public.current_tenant_id()));

-- gmail_connections (no existing policies)
CREATE POLICY "gc own" ON public.gmail_connections FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (user_id = auth.uid() AND tenant_id = public.current_tenant_id()))
WITH CHECK (public.is_super_admin(auth.uid()) OR (user_id = auth.uid() AND tenant_id = public.current_tenant_id()));

-- =========================================================================
-- 8. SERVER-SIDE: set active tenant + super admin audit log
-- =========================================================================

CREATE OR REPLACE FUNCTION public.set_active_tenant(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_tenant_access(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'No access to that organisation';
  END IF;
  UPDATE public.profiles SET active_tenant_id = _tenant_id WHERE id = auth.uid();
  IF public.is_super_admin(auth.uid()) THEN
    INSERT INTO public.activity_log(actor_id, module, entity_type, entity_id, verb, summary, tenant_id, metadata)
    VALUES (auth.uid(), 'settings', 'tenant', _tenant_id, 'switched',
            'Super admin switched into organisation', _tenant_id, '{}'::jsonb);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;

-- Update handle_new_user trigger fn to NOT auto-assign tenant (super admin invites)
-- Keep existing behaviour; new users land with no active tenant until invited.

-- Update updated_at trigger for tenants
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
