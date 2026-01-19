-- Debug: Check employee_branches data
-- Run this in Supabase SQL Editor to verify the data

-- 1. Check all employees and their assigned branches
SELECT 
    e.id,
    e.full_name,
    e.email,
    e.role,
    e.is_active,
    eb.branch_id,
    b.name as branch_name
FROM employees e
LEFT JOIN employee_branches eb ON e.id = eb.employee_id
LEFT JOIN branches b ON eb.branch_id = b.id
ORDER BY e.role, e.full_name;

-- 2. Check recent bookings with their branch_id
SELECT 
    id,
    customer_name,
    branch,
    branch_id,
    status,
    created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if branch_id in bookings matches branch_id in employee_branches
-- This query finds bookings that SHOULD be visible to each non-super_admin employee
SELECT 
    e.full_name as employee_name,
    e.role,
    eb.branch_id as employee_branch_id,
    b.name as branch_name,
    COUNT(bk.id) as matching_bookings
FROM employees e
JOIN employee_branches eb ON e.id = eb.employee_id
JOIN branches b ON eb.branch_id = b.id
LEFT JOIN bookings bk ON bk.branch_id = eb.branch_id
WHERE e.role != 'super_admin'
GROUP BY e.full_name, e.role, eb.branch_id, b.name;

-- 4. Check all branches
SELECT id, name, name_ar, is_active FROM branches ORDER BY name;
