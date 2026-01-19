import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// This route uses the service role key to bypass RLS
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
            return NextResponse.json({ error: 'Only super admins can manage employee branches' }, { status: 403 });
        }

        // Get request body
        const { employeeId, branchIds, clearExisting = true } = await request.json();

        if (!employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        // Clear existing branch assignments if requested
        if (clearExisting) {
            await adminClient
                .from('employee_branches')
                .delete()
                .eq('employee_id', employeeId);
        }

        // Insert new branch assignments
        if (branchIds && branchIds.length > 0) {
            const assignments = branchIds.map((branchId: string) => ({
                employee_id: employeeId,
                branch_id: branchId
            }));

            const { error: insertError } = await adminClient
                .from('employee_branches')
                .insert(assignments);

            if (insertError) {
                console.error('Error inserting employee branches:', insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error managing employee branches:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
