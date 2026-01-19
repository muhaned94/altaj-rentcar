-- Branch Logic Unification Fix
-- Ensures bookings and cars use branch_id UUIDs for reliable RBAC filtering

-- 1. Add branch_id to bookings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'branch_id') THEN
        ALTER TABLE bookings ADD COLUMN branch_id UUID REFERENCES branches(id);
    END IF;
END $$;

-- 2. Add branch_id to cars if it doesn't exist (it should be there, but ensuring)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'branch_id') THEN
        ALTER TABLE cars ADD COLUMN branch_id UUID REFERENCES branches(id);
    END IF;
END $$;

-- 3. Backfill branch_id in bookings from branch name if possible
-- This is a heuristic, best effort for existing records
UPDATE bookings b
SET branch_id = (
    SELECT id FROM branches br 
    WHERE b.branch ILIKE '%' || br.name || '%' 
    OR b.branch ILIKE '%' || br.name_ar || '%'
    LIMIT 1
)
WHERE b.branch_id IS NULL AND b.branch IS NOT NULL;

-- 4. Enable RLS on bookings if not already enabled
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 5. Create a unified RLS policy for bookings based on branch permissions
-- (Optional: only if you want database-level RLS to enforce filtering)
-- For now we rely on the application-level applyBranchFilter for flexibility
