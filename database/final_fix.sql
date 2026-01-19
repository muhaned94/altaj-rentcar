-- Final User Management & Branch Filtering Fix
-- This script ensures all users are correctly registered in the employees table and have proper roles.

-- 1. Ensure employees table has the correct structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'email') THEN
        ALTER TABLE employees ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Security function for RBAC (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reset and Apply Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage all employees" ON employees;
CREATE POLICY "Super admins can manage all employees"
ON employees FOR ALL USING (check_is_super_admin());

DROP POLICY IF EXISTS "Users can view their own profile" ON employees;
CREATE POLICY "Users can view their own profile"
ON employees FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Super admins can manage branches" ON employee_branches;
CREATE POLICY "Super admins can manage branches"
ON employee_branches FOR ALL USING (check_is_super_admin());

DROP POLICY IF EXISTS "Users can view their own branches" ON employee_branches;
CREATE POLICY "Users can view their own branches"
ON employee_branches FOR SELECT USING (EXISTS (
    SELECT 1 FROM employees WHERE id = auth.uid() AND (role = 'super_admin' OR id = employee_id)
));

-- 4. Sync Auth Users to Employees Table
-- This will backfill the employees table from auth.users for the specific accounts mentioned.
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Sync admin@altaj.iq
    FOR user_record IN SELECT id, email FROM auth.users WHERE email = 'admin@altaj.iq' LOOP
        INSERT INTO public.employees (id, full_name, email, role, is_active)
        VALUES (user_record.id, 'System Admin', user_record.email, 'super_admin', true)
        ON CONFLICT (id) DO UPDATE SET role = 'super_admin', email = EXCLUDED.email, is_active = true;
    END LOOP;

    -- Sync admin@ataj.iq (if it exists)
    FOR user_record IN SELECT id, email FROM auth.users WHERE email = 'admin@ataj.iq' LOOP
        INSERT INTO public.employees (id, full_name, email, role, is_active)
        VALUES (user_record.id, 'System Admin (Legacy)', user_record.email, 'super_admin', true)
        ON CONFLICT (id) DO UPDATE SET role = 'super_admin', email = EXCLUDED.email, is_active = true;
    END LOOP;

    -- Sync muhanad@altaj.iq
    FOR user_record IN SELECT id, email FROM auth.users WHERE email = 'muhanad@altaj.iq' LOOP
        INSERT INTO public.employees (id, full_name, email, role, is_active)
        VALUES (user_record.id, 'Muhanad (Manager)', user_record.email, 'branch_manager', true)
        ON CONFLICT (id) DO UPDATE SET role = 'branch_manager', email = EXCLUDED.email, is_active = true;
    END LOOP;
END $$;

-- 5. Backfill Bookings with branch_id if missing (using a best-guess from branch name)
UPDATE bookings b
SET branch_id = br.id
FROM branches br
WHERE b.branch_id IS NULL 
AND (b.branch = br.name OR b.branch = br.name_ar);

-- 6. Ensure RLS on Bookings is robust for the new branch_id column
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable branch-based access for bookings" ON bookings;
CREATE POLICY "Enable branch-based access for bookings"
ON bookings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM employees e
        LEFT JOIN employee_branches eb ON e.id = eb.employee_id
        WHERE e.id = auth.uid()
        AND (
            e.role = 'super_admin' 
            OR eb.branch_id = bookings.branch_id
        )
    )
);
