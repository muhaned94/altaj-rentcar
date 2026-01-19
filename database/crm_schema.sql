-- Customer Profiles Table for CRM
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS customer_profiles (
  phone_number VARCHAR(20) PRIMARY KEY,
  full_name VARCHAR(200),
  is_blacklisted BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access for customer_profiles"
  ON customer_profiles FOR SELECT
  USING (true);

CREATE POLICY "Public insert/update access for customer_profiles"
  ON customer_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
