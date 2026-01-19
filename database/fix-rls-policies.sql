-- =====================================================
-- RLS POLICIES FIX - Run this in Supabase SQL Editor
-- تشغيل هذا الملف في SQL Editor لإصلاح الصلاحيات
-- =====================================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CATEGORIES POLICIES
-- =====================================================
-- Allow public read access
DROP POLICY IF EXISTS "Allow public read categories" ON categories;
CREATE POLICY "Allow public read categories" ON categories
    FOR SELECT USING (true);

-- Allow public insert (for admin)
DROP POLICY IF EXISTS "Allow public insert categories" ON categories;
CREATE POLICY "Allow public insert categories" ON categories
    FOR INSERT WITH CHECK (true);

-- Allow public update
DROP POLICY IF EXISTS "Allow public update categories" ON categories;
CREATE POLICY "Allow public update categories" ON categories
    FOR UPDATE USING (true);

-- Allow public delete
DROP POLICY IF EXISTS "Allow public delete categories" ON categories;
CREATE POLICY "Allow public delete categories" ON categories
    FOR DELETE USING (true);

-- =====================================================
-- CARS POLICIES
-- =====================================================
-- Allow public read access
DROP POLICY IF EXISTS "Allow public read cars" ON cars;
CREATE POLICY "Allow public read cars" ON cars
    FOR SELECT USING (true);

-- Allow public insert (for admin)
DROP POLICY IF EXISTS "Allow public insert cars" ON cars;
CREATE POLICY "Allow public insert cars" ON cars
    FOR INSERT WITH CHECK (true);

-- Allow public update
DROP POLICY IF EXISTS "Allow public update cars" ON cars;
CREATE POLICY "Allow public update cars" ON cars
    FOR UPDATE USING (true);

-- Allow public delete
DROP POLICY IF EXISTS "Allow public delete cars" ON cars;
CREATE POLICY "Allow public delete cars" ON cars
    FOR DELETE USING (true);

-- =====================================================
-- BOOKINGS POLICIES
-- =====================================================
-- Allow public read access
DROP POLICY IF EXISTS "Allow public read bookings" ON bookings;
CREATE POLICY "Allow public read bookings" ON bookings
    FOR SELECT USING (true);

-- Allow public insert (customers can create bookings)
DROP POLICY IF EXISTS "Allow public insert bookings" ON bookings;
CREATE POLICY "Allow public insert bookings" ON bookings
    FOR INSERT WITH CHECK (true);

-- Allow public update (for admin to change status)
DROP POLICY IF EXISTS "Allow public update bookings" ON bookings;
CREATE POLICY "Allow public update bookings" ON bookings
    FOR UPDATE USING (true);

-- Allow public delete
DROP POLICY IF EXISTS "Allow public delete bookings" ON bookings;
CREATE POLICY "Allow public delete bookings" ON bookings
    FOR DELETE USING (true);

-- =====================================================
-- VERIFICATION - Check policies are created
-- =====================================================
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
