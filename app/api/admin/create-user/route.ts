import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// This route uses the SERVICE_ROLE_KEY to create users without auto-login
// Only accessible by super_admin users

export async function POST(request: NextRequest) {
    try {
        // Verify the caller is authenticated
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Create admin client with service role
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Verify the requesting user is a super_admin
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { data: requester } = await adminClient
            .from('employees')
            .select('role')
            .eq('id', user.id)
            .single();

        if (requester?.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only super admins can create users' }, { status: 403 });
        }

        // Get request body
        const { email, password, fullName, role, isActive } = await request.json();

        if (!email || !password || !fullName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create user using admin API (doesn't auto-login)
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: fullName,
                role: role
            }
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        if (!newUser.user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        const userId = newUser.user.id;

        // Create or update employee record (use upsert in case trigger already created it)
        const { error: empError } = await adminClient
            .from('employees')
            .upsert({
                id: userId,
                full_name: fullName,
                email: email,
                role: role,
                is_active: isActive ?? true
            }, { onConflict: 'id' });

        if (empError) {
            console.error('Error creating employee:', empError);
            // Try to clean up auth user if employee creation fails
            await adminClient.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: empError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            userId: userId,
            message: 'User created successfully'
        });

    } catch (error: any) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
