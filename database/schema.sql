-- Al-Taj Car Rental Platform - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cars Table
CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  color VARCHAR(50),
  daily_rate DECIMAL(10,2) NOT NULL CHECK (daily_rate > 0),
  features TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(200),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for better performance
CREATE INDEX idx_cars_category ON cars(category_id);
CREATE INDEX idx_cars_status ON cars(status);
CREATE INDEX idx_bookings_car ON bookings(car_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(start_date, end_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to cars table
CREATE TRIGGER update_cars_updated_at
  BEFORE UPDATE ON cars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to bookings table
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO categories (name, name_ar, description) VALUES
  ('Luxury', 'فاخرة', 'High-end luxury vehicles'),
  ('SUV', 'سيارات رياضية متعددة الاستخدامات', 'Sport Utility Vehicles'),
  ('Sedan', 'سيدان', 'Comfortable sedan cars'),
  ('Sports', 'رياضية', 'High-performance sports cars'),
  ('Electric', 'كهربائية', 'Eco-friendly electric vehicles')
ON CONFLICT DO NOTHING;

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Public read access for categories and cars
CREATE POLICY "Public read access for categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Public read access for cars"
  ON cars FOR SELECT
  USING (true);

-- Public read access for bookings (you may want to restrict this later)
CREATE POLICY "Public read access for bookings"
  ON bookings FOR SELECT
  USING (true);

-- Allow public insert for bookings (for customer booking forms)
CREATE POLICY "Public insert access for bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- Note: For admin operations (INSERT, UPDATE, DELETE on cars and categories),
-- you should implement authentication and create policies based on user roles.
-- For now, these operations can be done via the Supabase dashboard or with service role key.

-- Storage bucket for car images
-- Run this in the Supabase Storage section:
-- 1. Create a bucket named 'car-images'
-- 2. Make it public
-- 3. Set the following policies:

/*
Storage policies (to be set in Supabase Dashboard > Storage > car-images > Policies):

1. Public read access:
   - Operation: SELECT
   - Policy: (bucket_id = 'car-images')

2. Authenticated upload:
   - Operation: INSERT
   - Policy: (bucket_id = 'car-images')
   
3. Authenticated delete:
   - Operation: DELETE
   - Policy: (bucket_id = 'car-images')
*/
