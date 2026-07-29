CREATE OR REPLACE FUNCTION public.high_risk_categories()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    'hot_works',
    'confined_space',
    'working_at_height',
    'excavation',
    'deep_excavation',
    'lifting_operations',
    'overhead_powerlines',
    'demolition'
  ]::text[];
$$;

GRANT EXECUTE ON FUNCTION public.high_risk_categories() TO anon, authenticated, service_role;