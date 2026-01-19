-- Add is_featured column to cars table
-- Run this in your Supabase SQL Editor

ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Update some cars to be featured (optional, for demo)
-- UPDATE cars SET is_featured = TRUE WHERE ... ;
