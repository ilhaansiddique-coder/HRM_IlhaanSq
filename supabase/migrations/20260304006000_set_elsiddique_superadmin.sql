DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('elsiddique@gmail.com')
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found for elsiddique@gmail.com. Superadmin role not assigned.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'superadmin')
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (target_user_id, 'elsiddique@gmail.com', 'Super Admin', 'superadmin')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = now();
END $$;
