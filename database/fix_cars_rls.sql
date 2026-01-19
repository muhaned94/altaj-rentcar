-- FIX RLS for Cars Table
-- The cars table needs the same SECURITY DEFINER function approach as bookings

-- 1. Create a helper function to check if a user has access to a car via car_branches
CREATE OR REPLACE FUNCTION public.check_car_branch_access(car_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins have access to all cars
  IF EXISTS (SELECT 1 FROM employees WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true) THEN
    RETURN TRUE;
  END IF;

  -- Check if the user is assigned to any branch that has this car
  RETURN EXISTS (
    SELECT 1 
    FROM car_branches cb
    JOIN employee_branches eb ON cb.branch_id = eb.branch_id
    WHERE cb.car_id = car_id_param AND eb.employee_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing car policies and create new ones
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch staff can view their cars" ON cars;
DROP POLICY IF EXISTS "Public can view available cars" ON cars;
DROP POLICY IF EXISTS "Authenticated users can manage cars" ON cars;
DROP POLICY IF EXISTS "Enable branch-based access for cars" ON cars;

-- Public can view available cars (for the customer-facing pages)
CREATE POLICY "Public can view available cars"
ON cars
FOR SELECT
TO public
USING (status = 'available' OR status = 'rented');

-- Staff can view cars based on their branch assignments
CREATE POLICY "Branch staff can view their cars"
ON cars
FOR SELECT
TO authenticated
USING (check_car_branch_access(id));

-- Staff can manage cars in their branches
CREATE POLICY "Branch staff can manage their cars"
ON cars
FOR ALL
TO authenticated
USING (check_car_branch_access(id));
