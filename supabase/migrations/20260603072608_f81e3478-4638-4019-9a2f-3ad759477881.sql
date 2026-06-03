
-- 1. Add description to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS description text;

-- 2. Cost proposal settings (per tenant)
CREATE TABLE IF NOT EXISTS public.cost_proposal_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_path text,
  conditions_project text[] NOT NULL DEFAULT ARRAY[
    'This proposal is valid for 30 days.',
    'Invoices must be paid within 30 days.',
    'IO-Gen Ltd will keep all information from the client confidential'
  ],
  conditions_work text[] NOT NULL DEFAULT ARRAY[
    'This proposal is valid for 30 days.',
    'Invoices must be paid within 30 days.',
    'IO-Gen Ltd will keep all information from the client confidential'
  ],
  conditions_subscription text[] NOT NULL DEFAULT ARRAY[
    'This proposal is valid for 30 days.',
    'Invoices must be paid within 30 days.',
    'IO-Gen Ltd will keep all information from the client confidential'
  ],
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_proposal_settings TO authenticated;
GRANT ALL ON public.cost_proposal_settings TO service_role;

ALTER TABLE public.cost_proposal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cps read"
ON public.cost_proposal_settings FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

CREATE POLICY "cps insert"
ON public.cost_proposal_settings FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (tenant_id = current_tenant_id() AND is_admin(auth.uid()))
);

CREATE POLICY "cps update"
ON public.cost_proposal_settings FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (tenant_id = current_tenant_id() AND is_admin(auth.uid()))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (tenant_id = current_tenant_id() AND is_admin(auth.uid()))
);

CREATE POLICY "cps delete"
ON public.cost_proposal_settings FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (tenant_id = current_tenant_id() AND is_admin(auth.uid()))
);

CREATE TRIGGER cps_set_updated_at
BEFORE UPDATE ON public.cost_proposal_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
