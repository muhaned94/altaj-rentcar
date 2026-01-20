-- Add plate_number to cars table
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50);
-- Add index for faster searching by plate
CREATE INDEX IF NOT EXISTS idx_cars_plate_number ON cars(plate_number);
