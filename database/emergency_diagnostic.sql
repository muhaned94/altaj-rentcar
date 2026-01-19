-- EMERGENCY DIAGNOSTIC: What can Muhanad actually see?

-- 1. Get Muhanad's user ID
SELECT id as muhanad_user_id, email FROM employees WHERE email = 'muhanad@altaj.iq';

-- 2. Get Muhanad's assigned branches
SELECT eb.branch_id, b.name as branch_name
FROM employee_branches eb
JOIN branches b ON eb.branch_id = b.id
JOIN employees e ON eb.employee_id = e.id
WHERE e.email = 'muhanad@altaj.iq';

-- 3. Get cars that SHOULD be visible to Muhanad (cars in his branches)
SELECT c.id, c.name, cb.branch_id, b.name as branch_name
FROM cars c
JOIN car_branches cb ON c.id = cb.car_id
JOIN branches b ON cb.branch_id = b.id
WHERE cb.branch_id IN (
    SELECT eb.branch_id FROM employee_branches eb
    JOIN employees e ON eb.employee_id = e.id
    WHERE e.email = 'muhanad@altaj.iq'
);

-- 4. Test the check_car_branch_access function directly
-- Replace 'MUHANAD_USER_ID' with Muhanad's actual UUID from query #1
-- SELECT check_car_branch_access('CAR_ID_HERE');

-- 5. Check if RLS is enabled on cars
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'cars';
