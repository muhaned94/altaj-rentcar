-- URGENT FIX: Force-resolve booking branch_id using partial matching
-- The previous script used exact matching (=), but the text might have slight differences

-- Step 1: Show what we're working with
SELECT b.id, b.branch as booking_branch_text, br.name as branches_name, br.name_ar as branches_name_ar
FROM bookings b
CROSS JOIN branches br
WHERE b.branch_id IS NULL
LIMIT 10;

-- Step 2: Fix using PARTIAL matching (ILIKE for case-insensitive)
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
WHERE b.branch_id IS NULL;

-- Step 3: Verify the fix
SELECT id, branch, branch_id FROM bookings WHERE created_at = (SELECT MAX(created_at) FROM bookings);
