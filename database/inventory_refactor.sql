-- 1. Create car_inventory table
CREATE TABLE IF NOT EXISTS car_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
    plate_number VARCHAR(50),
    color VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available', -- 'available', 'rented', 'maintenance'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add inventory_id to bookings to track assignment
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES car_inventory(id);

-- 3. Migrate existing cars with plate numbers to inventory
-- We only migrate if they have a plate number, or we create one placeholder entry?
-- Plan: Create one inventory item for each existing car to preserve its current status.
INSERT INTO car_inventory (car_id, plate_number, color, status)
SELECT id, plate_number, color, status 
FROM cars;

-- 4. Enable RLS on new table (Optional but good practice)
ALTER TABLE car_inventory ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for booking availability checks)
CREATE POLICY "Public can view active inventory" 
ON car_inventory FOR SELECT 
USING (true);

-- Allow admins full access (adjust policy based on your auth setup, assuming authenticated for now or service role)
CREATE POLICY "Admins can manage inventory" 
ON car_inventory FOR ALL 
USING (auth.role() = 'authenticated'); -- Simplified for now, refine as needed

-- 5. (Optional) You might want to remove plate_number/status from cars table later, 
-- but we'll keep them for now to avoid breaking existing code immediately.
-- However, 'status' in cars table will now represent 'Overall Availability' (e.g. if any unit is available).
