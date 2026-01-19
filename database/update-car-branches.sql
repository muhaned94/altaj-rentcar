-- Create car_branches table (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS car_branches (
    car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (car_id, branch_id)
);

-- Enable RLS
ALTER TABLE car_branches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON car_branches;
DROP POLICY IF EXISTS "Admin write access" ON car_branches;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON car_branches;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON cars;

-- Policies for car_branches
CREATE POLICY "Public read access" ON car_branches
    FOR SELECT USING (true);

CREATE POLICY "Admin write access" ON car_branches
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for authenticated users" ON car_branches 
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON cars 
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Migrate existing data from cars.branch_id to car_branches
INSERT INTO car_branches (car_id, branch_id)
SELECT id, branch_id
FROM cars
WHERE branch_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Make branch_id Nullable to allow cars with multiple branches (managed in car_branches)
-- Handle case where column might not exist or constraint might be different
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'branch_id') THEN
        ALTER TABLE cars ALTER COLUMN branch_id DROP NOT NULL;
    END IF;
END $$;

-- Add plate_number if it doesn't exist
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plate_number TEXT;
