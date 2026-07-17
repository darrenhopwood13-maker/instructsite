DROP FUNCTION IF EXISTS public.accept_org_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_org_invite(_token uuid)
 RETURNS TABLE(out_org_id uuid, out_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email',''));
  v_inv public.org_invites;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.org_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invite % ', v_inv.status; END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'This invite is for %', v_inv.email;
  END IF;

  INSERT INTO public.org_members(org_id, user_id, role, is_standard)
  VALUES (v_inv.org_id, v_uid, v_inv.role, v_inv.is_standard)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_invites
     SET status='accepted', accepted_by=v_uid, accepted_at=now()
   WHERE id = v_inv.id;

  RETURN QUERY SELECT v_inv.org_id, v_inv.role;
END;
$function$;