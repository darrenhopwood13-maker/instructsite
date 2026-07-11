
-- Seed 5 admin test accounts, each linked to one Test Org as admin
DO $$
DECLARE
  v_uid uuid;
  v_email text;
  v_org_ids uuid[] := ARRAY[
    '73018a4a-1472-4c01-a0f6-a9dfffda99bd'::uuid,
    '77a6767c-0d3f-4bc9-ad6b-8408633b1594'::uuid,
    '2762940e-35ad-4fab-aa05-01caa16157fb'::uuid,
    '3096de37-b4ce-45d0-96e8-d8abadec2a73'::uuid,
    'b2fc390f-8a5d-4aaf-8a02-8627872d0145'::uuid
  ];
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    v_email := 'admin' || i || '@snagmaster.test';

    -- Skip if user already exists
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid, 'authenticated', 'authenticated', v_email,
        crypt('SnagMaster2026!', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Admin ' || i),
        now(), now(),
        '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;

    -- Link as org admin
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (v_org_ids[i], v_uid, 'admin')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
