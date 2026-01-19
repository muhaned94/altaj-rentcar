-- Optimizing Database Performance
-- 1. Add indexes to foreign keys involved in frequent filtering and joins
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branches_branch_id ON car_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_car_branches_car_id ON car_branches(car_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_employee_id ON employee_branches(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_branch_id ON employee_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- 2. Optimize the RLS Policy for Bookings
-- Instead of a complex join for every row, we can simplify/cache the admin check.
-- But first, let's just make sure the indexes are there, as that's often the biggest factor.

-- 3. Analyze query plans (Optional, but good practice)
ANALYZE bookings;
ANALYZE cars;
ANALYZE car_branches;
ANALYZE employees;
ANALYZE employee_branches;
