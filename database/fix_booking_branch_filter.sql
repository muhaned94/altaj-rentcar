-- Fix bookings with NULL branch_id by matching them to branches based on branch name

-- First, let's see which bookings have NULL branch_id
SELECT id, customer_name, branch, branch_id 
FROM bookings 
WHERE branch_id IS NULL;

-- Update bookings with NULL branch_id based on branch name matching
UPDATE bookings b
SET branch_id = br.id
FROM branches br
WHERE b.branch_id IS NULL
AND (
    b.branch ILIKE '%' || br.name || '%'
    OR b.branch ILIKE '%' || br.name_ar || '%'
    OR br.name ILIKE '%' || b.branch || '%'
    OR br.name_ar ILIKE '%' || b.branch || '%'
);

-- Verify the fix
SELECT id, customer_name, branch, branch_id 
FROM bookings 
WHERE branch_id IS NULL;

-- If still NULL, manually update based on specific branch names
-- Uncomment and modify as needed:
-- UPDATE bookings SET branch_id = (SELECT id FROM branches WHERE name = 'Erbil') WHERE branch ILIKE '%Erbil%' AND branch_id IS NULL;
-- UPDATE bookings SET branch_id = (SELECT id FROM branches WHERE name = 'Baghdad - Jadriya') WHERE branch ILIKE '%Jadriya%' AND branch_id IS NULL;
-- UPDATE bookings SET branch_id = (SELECT id FROM branches WHERE name = 'Baghdad - Mansour') WHERE branch ILIKE '%Mansour%' AND branch_id IS NULL;
