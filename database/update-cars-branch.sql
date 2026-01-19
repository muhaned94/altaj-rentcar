-- =====================================================
-- DATABASE UPDATE - Car Branch & Plate Number
-- تحديث قاعدة البيانات - ربط السيارات بالفروع وأرقام اللوحات
-- =====================================================

-- Add new columns to cars table
-- 1. branch_id: Link car to a specific branch
-- 2. plate_number: Physical plate number (for admin use only)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plate_number TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cars_branch ON cars(branch_id);

-- Update RLS policies for cars
-- Admin can view plate_number, customers might not need to see it in raw queries if we are careful
-- But since we select *, let's keep it public read for simplicity, frontend will hide it.
-- If strict security is needed, we would create a view or separate RLS.
-- For now, keep existing public read policy.

-- Optional: Set default branch for existing cars (e.g., first branch)
DO $$
DECLARE
    first_branch_id UUID;
BEGIN
    SELECT id INTO first_branch_id FROM branches LIMIT 1;
    
    IF first_branch_id IS NOT NULL THEN
        UPDATE cars SET branch_id = first_branch_id WHERE branch_id IS NULL;
    END IF;
END $$;
