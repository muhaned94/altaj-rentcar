-- Fix RLS Policy for Bookings
-- The issue: RLS policies on 'employees' and 'employee_branches' block the subquery in the bookings policy.
-- The solution: Use a SECURITY DEFINER function to bypass RLS for the permission check.

-- 1. Create a helper function to check if a user has access to a specific branch
CREATE OR REPLACE FUNCTION public.check_branch_access(target_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins have access to all branches
  IF EXISTS (SELECT 1 FROM employees WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true) THEN
    RETURN TRUE;
  END IF;

  -- Check if the user is assigned to this specific branch
  RETURN EXISTS (
    SELECT 1 FROM employee_branches
    WHERE employee_id = auth.uid() AND branch_id = target_branch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the Bookings RLS Policy to use the helper function
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable branch-based access for bookings" ON bookings;
DROP POLICY IF EXISTS "Branch staff can view their bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;

-- Policy for SELECT: Super admins see all, others see their branch
CREATE POLICY "Branch staff can view their bookings"
ON bookings
FOR SELECT
USING (check_branch_access(branch_id));

-- Policy for INSERT: Anyone authenticated can create a booking (customers create pending bookings)
CREATE POLICY "Authenticated users can insert bookings"
ON bookings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy for UPDATE/DELETE: Only staff with branch access can modify
CREATE POLICY "Branch staff can manage their bookings"
ON bookings
FOR UPDATE
USING (check_branch_access(branch_id));

CREATE POLICY "Branch staff can delete their bookings"
ON bookings
FOR DELETE
USING (check_branch_access(branch_id));
