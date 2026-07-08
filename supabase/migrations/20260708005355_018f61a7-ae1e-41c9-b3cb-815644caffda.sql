-- =========================================================================
-- 1. Subscription tier enum
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('baseline', 'structure', 'apex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 2. project_subscriptions
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  tier public.subscription_tier NOT NULL DEFAULT 'baseline',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.project_subscriptions TO authenticated;
GRANT ALL ON public.project_subscriptions TO service_role;

ALTER TABLE public.project_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view subscription"
  ON public.project_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

-- No INSERT/UPDATE/DELETE policies for authenticated: only the Stripe webhook
-- (service_role) writes to this table.

CREATE TRIGGER trg_project_subscriptions_updated_at
  BEFORE UPDATE ON public.project_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. bespoke_upgrade_requests
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.bespoke_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bespoke_upgrade_requests TO authenticated;
GRANT ALL ON public.bespoke_upgrade_requests TO service_role;

ALTER TABLE public.bespoke_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project admins view bespoke requests"
  ON public.bespoke_upgrade_requests FOR SELECT
  TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "Project admins create bespoke requests"
  ON public.bespoke_upgrade_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    AND requested_by = auth.uid()
  );

CREATE TRIGGER trg_bespoke_upgrade_requests_updated_at
  BEFORE UPDATE ON public.bespoke_upgrade_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 4. has_feature() — canonical feature gating
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_feature(_project_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.subscription_tier;
  v_status public.subscription_status;
BEGIN
  SELECT tier, status INTO v_tier, v_status
    FROM public.project_subscriptions
   WHERE project_id = _project_id;

  -- No subscription row → treat as baseline trial
  IF v_tier IS NULL THEN
    v_tier := 'baseline';
    v_status := 'trialing';
  END IF;

  -- Cancelled or past_due only get baseline features
  IF v_status IN ('canceled', 'incomplete') THEN
    v_tier := 'baseline';
  END IF;

  RETURN CASE _feature
    -- Baseline features
    WHEN 'dabs'          THEN TRUE
    WHEN 'diary'         THEN TRUE
    WHEN 'oracle_ai'     THEN TRUE
    -- Structure features
    WHEN 'bim_viewport'  THEN v_tier IN ('structure','apex')
    WHEN 'randall_auto'  THEN v_tier IN ('structure','apex')
    -- Apex-only features
    WHEN 'erp_bridge'    THEN v_tier = 'apex'
    WHEN 'sso'           THEN v_tier = 'apex'
    WHEN 'green_mesh'    THEN v_tier = 'apex'
    WHEN 'dedicated_tam' THEN v_tier = 'apex'
    ELSE FALSE
  END;
END;
$$;

-- =========================================================================
-- 5. Subcontractor seat cap: 3 seats per company per project (1 admin + 2 read-only)
-- =========================================================================
ALTER TABLE public.subcontractor_invites
  ADD COLUMN IF NOT EXISTS seat_role TEXT NOT NULL DEFAULT 'read_only'
    CHECK (seat_role IN ('admin', 'read_only'));

CREATE OR REPLACE FUNCTION public.enforce_subcontractor_seat_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin_count INT;
  v_readonly_count INT;
BEGIN
  IF NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE seat_role = 'admin'),
    COUNT(*) FILTER (WHERE seat_role = 'read_only')
  INTO v_admin_count, v_readonly_count
  FROM public.subcontractor_invites
  WHERE project_id = NEW.project_id
    AND lower(company_name) = lower(NEW.company_name)
    AND revoked_at IS NULL
    AND (accepted_at IS NOT NULL OR expires_at > now())
    AND id <> NEW.id;

  IF NEW.seat_role = 'admin' AND v_admin_count >= 1 THEN
    RAISE EXCEPTION 'SEAT_CAP_ADMIN: This subcontractor already has an admin seat.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.seat_role = 'read_only' AND v_readonly_count >= 2 THEN
    RAISE EXCEPTION 'SEAT_CAP_READONLY: Maximum capacity reached (2 read-only seats).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (v_admin_count + v_readonly_count + 1) > 3 THEN
    RAISE EXCEPTION 'SEAT_CAP_TOTAL: Maximum capacity reached (3 seats per subcontractor).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subcontractor_seat_cap ON public.subcontractor_invites;
CREATE TRIGGER trg_enforce_subcontractor_seat_cap
  BEFORE INSERT OR UPDATE OF seat_role, revoked_at, company_name, project_id
  ON public.subcontractor_invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subcontractor_seat_cap();

-- =========================================================================
-- 6. Seat usage helper (for UI counters)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.subcontractor_seat_usage(_project_id UUID, _company_name TEXT)
RETURNS TABLE(admin_used INT, readonly_used INT, admin_cap INT, readonly_cap INT, total_cap INT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE seat_role = 'admin')::INT,
    COUNT(*) FILTER (WHERE seat_role = 'read_only')::INT,
    1, 2, 3
  FROM public.subcontractor_invites
  WHERE project_id = _project_id
    AND lower(company_name) = lower(_company_name)
    AND revoked_at IS NULL
    AND (accepted_at IS NOT NULL OR expires_at > now());
$$;