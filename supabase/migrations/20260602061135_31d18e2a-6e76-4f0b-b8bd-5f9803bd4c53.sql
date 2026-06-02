
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
    'activity_log','notifications','assignments','gmail_connections'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id()', t);
  END LOOP;
END $$;

-- module_access stays explicit (admin assigns per tenant) but also default for convenience
ALTER TABLE public.module_access ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
