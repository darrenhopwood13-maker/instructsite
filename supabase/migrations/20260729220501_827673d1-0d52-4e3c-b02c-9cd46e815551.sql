CREATE OR REPLACE FUNCTION public.public_function_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.proname::text), ARRAY[]::text[])
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';
$$;

REVOKE ALL ON FUNCTION public.public_function_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_function_names() TO anon, authenticated, service_role;