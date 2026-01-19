-- Debug function to dump employees bypassing RLS
CREATE OR REPLACE FUNCTION public.debug_dump_employees()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY SELECT e.id, e.full_name, e.email, e.role, e.is_active, e.created_at FROM public.employees e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
