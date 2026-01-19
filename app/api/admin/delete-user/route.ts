import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// This route uses the SERVICE_ROLE_KEY to delete users from auth.users
// Only accessible by super_admin users

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Verify the requester is a super_admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !requestingUser) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check if requester is super_admin
        const { data: requesterProfile } = await supabaseAdmin
            .from('employees')
            .select('role')
            .eq('id', requestingUser.id)
            .single();

        if (requesterProfile?.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only super admins can delete users' }, { status: 403 });
        }

        // Prevent self-deletion
        if (userId === requestingUser.id) {
            return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
        }

        // Delete from employees table first (cascade will handle employee_branches)
        const { error: employeeError } = await supabaseAdmin
            .from('employees')
            .delete()
            .eq('id', userId);

        if (employeeError) {
            console.error('Error deleting employee:', employeeError);
            return NextResponse.json({ error: employeeError.message }, { status: 500 });
        }

        // Delete from auth.users
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error('Error deleting auth user:', authDeleteError);
            return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'User deleted successfully' });

    } catch (error: any) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
