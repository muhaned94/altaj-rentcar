-- COMPREHENSIVE FIX: Resolve all branch_id issues

-- 1. Fix Bookings with NULL branch_id (using partial matching)
UPDATE bookings b
SET branch_id = (
    SELECT br.id FROM branches br
    WHERE 
        b.branch ILIKE '%' || br.name || '%'
        OR b.branch ILIKE '%' || br.name_ar || '%'
        OR br.name ILIKE '%' || b.branch || '%'
        OR br.name_ar ILIKE '%' || b.branch || '%'
    LIMIT 1
)
WHERE b.branch_id IS NULL AND b.branch IS NOT NULL;

-- 2. Fix Cars with no branch assignments
-- First, check if there are any cars without branches
-- Then assign them to all active branches (or a default)
INSERT INTO car_branches (car_id, branch_id)
SELECT c.id, b.id
FROM cars c
CROSS JOIN branches b
WHERE b.is_active = true
AND c.id NOT IN (SELECT car_id FROM car_branches)
ON CONFLICT DO NOTHING;

-- 3. Verify Fixes
SELECT 'Bookings with NULL branch_id:' as check_type, count(*) as count FROM bookings WHERE branch_id IS NULL
UNION ALL
SELECT 'Cars without branch assignments:', count(*) FROM cars WHERE id NOT IN (SELECT car_id FROM car_branches);
