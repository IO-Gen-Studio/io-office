-- 1) Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC/anon; grant only to authenticated + service_role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- handle_new_user is a trigger function on auth.users; ensure supabase_auth_admin can execute
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- 2) gmail_connections: remove overly-permissive policy and revoke direct client grants
DROP POLICY IF EXISTS "gc own" ON public.gmail_connections;
DROP POLICY IF EXISTS "gmail_connections tenant isolation select" ON public.gmail_connections;
DROP POLICY IF EXISTS "gmail_connections tenant isolation insert" ON public.gmail_connections;
DROP POLICY IF EXISTS "gmail_connections tenant isolation update" ON public.gmail_connections;
DROP POLICY IF EXISTS "gmail_connections tenant isolation delete" ON public.gmail_connections;

REVOKE ALL ON public.gmail_connections FROM anon, authenticated;
GRANT ALL ON public.gmail_connections TO service_role;

-- Defense in depth: keep RLS enabled. No policies = no access for anon/authenticated.
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- 3) user_roles: add explicit UPDATE policy restricted to admins
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
CREATE POLICY "user_roles admin update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
