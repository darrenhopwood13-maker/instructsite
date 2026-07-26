-- =========================================================
-- WORKFACE REGISTER
--
-- A workface is a sensible, buildable chunk of work (e.g. "Level 03 East —
-- Drylining — First Fix") that sits beneath a subcontractor package and,
-- optionally, a raw work_zone. It exists to solve a real problem with the
-- current progress model: today, daily_site_diaries progress is summed per
-- work_zone (see zone_approved_completion()) with no regard for which
-- package it came from. Two unrelated packages working in the same zone
-- (e.g. Drylining and Electrical both in "Level 03 East") would have their
-- unrelated completion percentages added together, which could falsely
-- push a shared zone to 100% off the back of only one trade's work.
--
-- Workfaces are package-scoped, so each package's progress is tracked
-- independently even when several packages share the same physical zone.
-- Wiring daily_site_diaries progress calculation onto workface_id instead
-- of zone_id is a separate, deliberately scoped follow-up step — this
-- migration only introduces the register itself.
-- =========================================================

CREATE TABLE public.workfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.work_zones(id) ON DELETE SET NULL,
  package_invite_id uuid REFERENCES public.subcontractor_invites(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text, -- e.g. "First Fix", "Second Fix", "Snagging" — optional
  source text NOT NULL DEFAULT 'manual', -- 'auto_drawing' | 'auto_ifc' | 'auto_logistics' | 'manual'
  status text NOT NULL DEFAULT 'proposed', -- 'proposed' | 'confirmed' | 'archived'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workfaces_status_check CHECK (status IN ('proposed', 'confirmed', 'archived')),
  CONSTRAINT workfaces_source_check CHECK (source IN ('auto_drawing', 'auto_ifc', 'auto_logistics', 'manual'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workfaces TO authenticated;
GRANT ALL ON public.workfaces TO service_role;
ALTER TABLE public.workfaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workfaces" ON public.workfaces
  FOR SELECT TO authenticated USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project admins manage workfaces" ON public.workfaces
  FOR ALL TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- Package Managers can also confirm/rename/merge workfaces on packages
-- assigned to them, without needing full project-admin rights.
CREATE POLICY "Package managers manage their workfaces" ON public.workfaces
  FOR UPDATE TO authenticated
  USING (public.is_package_manager(package_invite_id, auth.uid()))
  WITH CHECK (public.is_package_manager(package_invite_id, auth.uid()));

CREATE INDEX idx_workfaces_project ON public.workfaces(project_id);
CREATE INDEX idx_workfaces_zone ON public.workfaces(zone_id);
CREATE INDEX idx_workfaces_package ON public.workfaces(package_invite_id);
CREATE INDEX idx_workfaces_status ON public.workfaces(project_id, status);

CREATE TRIGGER update_workfaces_updated_at BEFORE UPDATE ON public.workfaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Auto-suggestion: proposes one workface per (active work_zone x accepted
-- package) combination that doesn't already have one. This is the "both"
-- approach agreed on — automatic proposals the manager then confirms,
-- renames, splits, merges, or deletes; nothing here is final until a
-- Project Admin or the assigned Package Manager confirms it.
-- Safe to call repeatedly — it will never create a duplicate for a
-- zone/package pair that already has a non-archived workface.
-- =========================================================
CREATE OR REPLACE FUNCTION public.suggest_workfaces(_project_id uuid)
RETURNS SETOF public.workfaces
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_project_admin(_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Project admin role required.';
  END IF;

  RETURN QUERY
  INSERT INTO public.workfaces (project_id, zone_id, package_invite_id, name, source, status, created_by)
  SELECT
    z.project_id,
    z.id,
    si.id,
    trim(both ' ' from coalesce(z.level || ' — ', '') || z.name || ' — ' || si.company_name),
    'auto_drawing',
    'proposed',
    auth.uid()
  FROM public.work_zones z
  CROSS JOIN public.subcontractor_invites si
  WHERE z.project_id = _project_id
    AND si.project_id = _project_id
    AND z.status = 'active'
    AND si.accepted_at IS NOT NULL
    AND si.revoked_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.workfaces w
      WHERE w.zone_id = z.id
        AND w.package_invite_id = si.id
        AND w.status <> 'archived'
    )
  RETURNING public.workfaces.*;
END;
$$;
