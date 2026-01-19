-- Add national_id column to bookings table for rental contracts
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS national_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bookings.national_id IS 'Customer national ID number, entered manually by admin';
