-- Fix employee_branches RLS Policy
-- This fixes the issue where adding new admin users fails with:
-- "new row violates row-level security policy for table employee_branches"

-- 1. First, drop existing policies on employee_branches
DROP POLICY IF EXISTS "Super admins can manage employee_branches" ON employee_branches;
DROP POLICY IF EXISTS "Users can view their own branch assignments" ON employee_branches;

-- 2. Create new policies using the SECURITY DEFINER function
-- This prevents infinite recursion and permission issues

-- Policy for super_admins to manage all employee_branches
CREATE POLICY "Super admins can manage employee_branches"
ON employee_branches
FOR ALL
USING (public.check_is_super_admin())
WITH CHECK (public.check_is_super_admin());

-- Policy for users to view their own branch assignments
CREATE POLICY "Users can view their own branch assignments"
ON employee_branches
FOR SELECT
USING (auth.uid() = employee_id);

-- 3. Make sure the check_is_super_admin function exists with SECURITY DEFINER
-- (Re-create it to ensure it has the correct definition)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
