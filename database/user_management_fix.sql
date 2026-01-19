-- User Management & RBAC Schema Fix v2
-- Adding email column and fixing recursion

-- 1. Add email column to employees if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'email') THEN
        ALTER TABLE employees ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Create a security definer function to check for super_admin role
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update employees table policies
DROP POLICY IF EXISTS "Super admins can manage all employees" ON employees;
CREATE POLICY "Super admins can manage all employees"
ON employees
FOR ALL
USING (check_is_super_admin());

DROP POLICY IF EXISTS "Users can view their own profile" ON employees;
CREATE POLICY "Users can view their own profile"
ON employees
FOR SELECT
USING (auth.uid() = id);

-- 4. Automatically seed/update the admin account
DO $$
DECLARE
    target_user auth.users;
BEGIN
    SELECT * INTO target_user FROM auth.users WHERE email = 'admin@altaj.iq' LIMIT 1;
    
    IF target_user.id IS NOT NULL THEN
        INSERT INTO public.employees (id, full_name, email, role, is_active)
        VALUES (target_user.id, 'System Administrator', target_user.email, 'super_admin', true)
        ON CONFLICT (id) DO UPDATE SET role = 'super_admin', is_active = true, email = EXCLUDED.email;
    END IF;
END $$;
