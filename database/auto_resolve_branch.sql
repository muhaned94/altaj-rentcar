-- Trigger to automatically populate branch_id if missing
-- This maps the legacy text 'branch' column to the UUID 'branch_id' column

CREATE OR REPLACE FUNCTION public.resolve_booking_branch_id()
RETURNS TRIGGER AS $$
DECLARE
    found_branch_id UUID;
BEGIN
    -- Only attempt resolution if branch_id is NULL and branch (text) is NOT NULL
    IF NEW.branch_id IS NULL AND NEW.branch IS NOT NULL THEN
        
        -- Try to find by English name
        SELECT id INTO found_branch_id FROM branches WHERE name = NEW.branch LIMIT 1;
        
        -- If not found, try to find by Arabic name
        IF found_branch_id IS NULL THEN
            SELECT id INTO found_branch_id FROM branches WHERE name_ar = NEW.branch LIMIT 1;
        END IF;

        -- If found, assign it
        IF found_branch_id IS NOT NULL THEN
            NEW.branch_id := found_branch_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS before_booking_insert_update ON bookings;
CREATE TRIGGER before_booking_insert_update
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE PROCEDURE public.resolve_booking_branch_id();

-- Fix existing broken bookings
UPDATE bookings b
SET branch_id = br.id
FROM branches br
WHERE b.branch_id IS NULL 
AND (b.branch = br.name OR b.branch = br.name_ar);
