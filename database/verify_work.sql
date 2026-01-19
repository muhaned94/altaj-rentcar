-- Comprehensive System Verification Script

-- 1. Check User Roles
SELECT id, email, role, is_active FROM employees WHERE email IN ('admin@altaj.iq', 'muhanad@altaj.iq');

-- 2. Check Branch Assignments for Muhanad
SELECT e.email, b.name as branch_name 
FROM employees e
JOIN employee_branches eb ON e.id = eb.employee_id
JOIN branches b ON eb.branch_id = b.id
WHERE e.email = 'muhanad@altaj.iq';

-- 3. Check Bookings Data Integrity (Ensure branch_id is populated for notifications)
SELECT 
    count(*) as total_bookings,
    count(branch_id) as bookings_with_branch_id,
    count(*) - count(branch_id) as orphaned_bookings
FROM bookings;

-- 4. Verify Trigger Existence
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_name = 'on_auth_user_created';
