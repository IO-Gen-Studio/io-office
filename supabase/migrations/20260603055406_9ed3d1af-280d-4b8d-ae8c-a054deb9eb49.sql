CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id uuid, _tenant_id uuid)
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
      AND role = 'owner'
  )
$$;

DROP POLICY IF EXISTS "tm read" ON public.tenant_members;
CREATE POLICY "tm read" ON public.tenant_members
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR public.is_tenant_owner(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "tenants read" ON public.tenants;
CREATE POLICY "tenants read" ON public.tenants
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_tenant_access(auth.uid(), id)
);