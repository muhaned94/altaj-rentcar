-- Assign orphaned cars (cars with no branches) to ALL active branches
-- This ensures they become visible to everyone. You can then edit specific assignments in the UI.

INSERT INTO car_branches (car_id, branch_id)
SELECT c.id, b.id
FROM cars c
CROSS JOIN branches b
WHERE b.is_active = true
AND c.id NOT IN (SELECT car_id FROM car_branches)
ON CONFLICT DO NOTHING;

-- Verification: Should be 0 after running
SELECT count(*) as remaining_orphans 
FROM cars 
WHERE id NOT IN (SELECT car_id FROM car_branches);
