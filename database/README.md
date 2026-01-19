# Database Setup Guide

## Prerequisites
- Supabase account (https://supabase.com)
- Supabase project created

## Setup Steps

### 1. Create Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details
4. Wait for project to be provisioned

### 2. Get API Credentials
1. Navigate to Project Settings → API
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Update Environment Variables
1. Open `.env.local` in the project root
2. Replace the placeholder values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### 4. Run Database Schema
1. In Supabase Dashboard, go to SQL Editor
2. Click "New query"
3. Copy the entire content of `database/schema.sql`
4. Paste and click "Run"
5. Verify tables are created in Table Editor

### 5. Create Storage Bucket
1. In Supabase Dashboard, go to Storage
2. Click "Create bucket"
3. Name it `car-images`
4. Make it **Public**
5. Click "Create bucket"

### 6. Set Storage Policies
1. Click on the `car-images` bucket
2. Go to "Policies" tab
3. Add the following policies:

   **Policy 1: Public Read**
   - Name: `Public read access`
   - Operation: SELECT
   - Policy definition: `true` (or use the SQL: `(bucket_id = 'car-images')`)

   **Policy 2: Public Upload** (for admin functionality)
   - Name: `Public upload access`
   - Operation: INSERT
   - Policy definition: `true`

   **Policy 3: Public Delete** (for admin functionality)
   - Name: `Public delete access`
   - Operation: DELETE
   - Policy definition: `true`

## Verify Setup

### Check Tables
In Supabase Table Editor, you should see:
- `categories` - with 5 default categories
- `cars` - empty
- `bookings` - empty

### Check Storage
- Bucket `car-images` should be created and public

## Next Steps

Once the database is set up:
1. Restart your development server (`npm run dev`)
2. The application will connect to Supabase
3. Use the admin panel to add cars
4. Test the booking flow

## Troubleshooting

**Connection Issues:**
- Verify `.env.local` values match Supabase dashboard
- Ensure the file is in the project root
- Restart dev server after changing environment variables

**Storage Upload Errors:**
- Check bucket is public
- Verify storage policies are set correctly
- Check browser console for specific error messages

**RLS Errors:**
- Ensure RLS policies are created as per schema.sql
- For admin operations, you may need to use service role key (not recommended for production)
