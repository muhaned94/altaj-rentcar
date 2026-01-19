-- User Management & RBAC Schema
-- Run this in your Supabase SQL Editor

-- 1. Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'branch_manager', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create employee_branches junction table
CREATE TABLE IF NOT EXISTS employee_branches (
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, branch_id)
);

-- 3. Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_branches ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for employees
-- Allow super_admins to manage all employees
CREATE POLICY "Super admins can manage all employees"
ON employees
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM employees
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
ON employees
FOR SELECT
USING (auth.uid() = id);

-- 5. RLS Policies for employee_branches
CREATE POLICY "Super admins can manage employee_branches"
ON employee_branches
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM employees
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can view their own branch assignments"
ON employee_branches
FOR SELECT
USING (auth.uid() = employee_id);

-- 6. Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
