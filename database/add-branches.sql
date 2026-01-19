-- =====================================================
-- DATABASE UPDATE - Add branch and pickup_time fields
-- تحديث قاعدة البيانات - إضافة الفرع ووقت الاستلام
-- =====================================================

-- Add new columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_time TIME;

-- Create branches table for Iraqi cities/branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    address TEXT,
    address_ar TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branches
CREATE POLICY "Allow public read branches" ON branches
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert branches" ON branches
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update branches" ON branches
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete branches" ON branches
    FOR DELETE USING (true);

-- Insert Iraqi branches/cities
INSERT INTO branches (name, name_ar, address, address_ar, phone) VALUES
('Baghdad - Jadriya', 'بغداد - الجادرية', 'Al-Jadriya Street, near Baghdad University', 'شارع الجادرية، قرب جامعة بغداد', '+964 770 000 0001'),
('Baghdad - Mansour', 'بغداد - المنصور', 'Al-Mansour District, Main Street', 'حي المنصور، الشارع الرئيسي', '+964 770 000 0002'),
('Baghdad - Karrada', 'بغداد - الكرادة', 'Al-Karrada District, Commercial Area', 'حي الكرادة، المنطقة التجارية', '+964 770 000 0003'),
('Erbil', 'أربيل', 'Erbil City Center', 'مركز مدينة أربيل', '+964 770 000 0004'),
('Basra', 'البصرة', 'Basra City Center', 'مركز مدينة البصرة', '+964 770 000 0005'),
('Sulaymaniyah', 'السليمانية', 'Sulaymaniyah City Center', 'مركز مدينة السليمانية', '+964 770 000 0006'),
('Najaf', 'النجف', 'Najaf City Center', 'مركز مدينة النجف', '+964 770 000 0007'),
('Karbala', 'كربلاء', 'Karbala City Center', 'مركز مدينة كربلاء', '+964 770 000 0008')
ON CONFLICT DO NOTHING;

-- Verification
SELECT * FROM branches;
