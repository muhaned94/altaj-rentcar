-- Comprehensive Branch ID Diagnostic
-- This will tell us EXACTLY why Muhanad can't see the booking

-- 1. Get the booking's branch_id (the booking that the Super Admin sees)
SELECT 
    b.id as booking_id,
    b.customer_name,
    b.branch as branch_text,
    b.branch_id as booking_branch_id,
    br.name as resolved_branch_name
FROM bookings b
LEFT JOIN branches br ON b.branch_id = br.id
ORDER BY b.created_at DESC
LIMIT 1;

-- 2. Get Muhanad's assigned branch IDs
SELECT 
    e.email,
    eb.branch_id as assigned_branch_id,
    br.name as assigned_branch_name
FROM employees e
JOIN employee_branches eb ON e.id = eb.employee_id
JOIN branches br ON eb.branch_id = br.id
WHERE e.email = 'muhanad@altaj.iq';

-- 3. Direct comparison: Does the booking's branch_id exist in Muhanad's assignments?
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM employee_branches eb
            JOIN employees e ON e.id = eb.employee_id
            WHERE e.email = 'muhanad@altaj.iq'
            AND eb.branch_id = (
                SELECT branch_id FROM bookings ORDER BY created_at DESC LIMIT 1
            )
        ) 
        THEN 'MATCH: Muhanad SHOULD see the booking'
        ELSE 'NO MATCH: Branch IDs are different'
    END as diagnosis;

-- 4. Check if the booking's branch_id is NULL
SELECT 
    CASE 
        WHEN (SELECT branch_id FROM bookings ORDER BY created_at DESC LIMIT 1) IS NULL
        THEN 'PROBLEM: Booking has NULL branch_id'
        ELSE 'OK: Booking has a branch_id'
    END as branch_id_status;
