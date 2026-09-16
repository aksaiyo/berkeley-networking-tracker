-- Contacts are available only through authenticated JWT requests that pass RLS.
-- These explicit revokes make the table fail closed if role defaults change.
REVOKE ALL PRIVILEGES ON TABLE public.contacts FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.contacts FROM anonymous;

-- The trigger function is internal to the table and should not be callable by
-- anonymous or ordinary authenticated API roles.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anonymous;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;
