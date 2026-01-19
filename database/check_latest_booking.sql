-- Inspect the most recent booking to see if branch_id is populated
SELECT 
    b.id, 
    b.created_at, 
    b.branch,         -- Text name
    b.branch_id,      -- UUID (THIS MUST NOT BE NULL)
    b.customer_name,
    br.name as resolved_branch_name
FROM bookings b
LEFT JOIN branches br ON b.branch_id = br.id
ORDER BY created_at DESC
LIMIT 1;

-- Also verify Muhanad's branch assignments again to be 100% sure
SELECT e.full_name, e.email, b.name as assigned_branch, b.id as assigned_branch_id
FROM employees e
JOIN employee_branches eb ON e.id = eb.employee_id
JOIN branches b ON eb.branch_id = b.id
WHERE e.email = 'muhanad@altaj.iq';
