-- Lock down gmail_connections: OAuth tokens must never be readable by clients.
DROP POLICY IF EXISTS "gmail own all" ON public.gmail_connections;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.gmail_connections FROM authenticated;
REVOKE ALL ON public.gmail_connections FROM anon;
GRANT ALL ON public.gmail_connections TO service_role;
-- RLS stays enabled; with no policies, authenticated clients get zero access.
-- All Gmail token reads/writes must go through server functions using supabaseAdmin.