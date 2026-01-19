import { supabase } from './supabase';
import { Employee, UserRole } from './types';

/**
 * Fetches the current logged in employee's profile and their assigned branches.
 */
// Helper to cache the current employee promise to avoid duplicate requests
let currentEmployeePromise: Promise<Employee | null> | null = null;
let lastResetToken: string | null = null;

/**
 * Clears the employee cache - call this on login/logout
 */
export function clearEmployeeCache() {
    currentEmployeePromise = null;
    lastResetToken = null;
}

export async function getCurrentEmployee() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        // Reset cache if user changed
        if (lastResetToken !== session.access_token) {
            currentEmployeePromise = null;
            lastResetToken = session.access_token;
        }

        if (currentEmployeePromise) return currentEmployeePromise;

        currentEmployeePromise = (async () => {
            const { data: employee, error } = await supabase
                .from('employees')
                .select(`
                    *,
                    employee_branches (
                        branch_id
                    )
                `)
                .eq('id', session.user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching employee profile:', error); // Keep this for real errors
                return null;
            }

            return employee as Employee;
        })();

        return currentEmployeePromise;
    } catch (error) {
        console.error('Unexpected error in getCurrentEmployee:', error);
        return null;
    }
}

/**
 * Checks if the current employee has one of the required roles.
 */
export async function hasRole(allowedRoles: UserRole[]) {
    const employee = await getCurrentEmployee();
    if (!employee || !employee.is_active) return false;
    return allowedRoles.includes(employee.role);
}

/**
 * Returns the list of branch IDs that the current employee is allowed to manage.
 * If the employee is a super_admin, it returns null (meaning all branches).
 */
export async function getAllowedBranchIds(): Promise<string[] | null> {
    const employee = await getCurrentEmployee();
    if (!employee || !employee.is_active) return [];

    if (employee.role === 'super_admin') return null;

    return employee.employee_branches?.map(eb => eb.branch_id) || [];
}

/**
 * Helper to filter Supabase queries by branch for non-admin users.
 */
export async function applyBranchFilter(query: any, branchColumn: string = 'branch_id') {
    const allowedBranchIds = await getAllowedBranchIds();

    // If null, it's a super_admin, no filter needed
    if (allowedBranchIds === null) return query;

    // If empty array, user has no branches assigned - use a fake UUID that won't match anything
    if (allowedBranchIds.length === 0) {
        return query.in(branchColumn, ['00000000-0000-0000-0000-000000000000']);
    }

    return query.in(branchColumn, allowedBranchIds);
}
