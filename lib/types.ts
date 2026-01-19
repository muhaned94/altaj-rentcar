export interface Category {
    id: string;
    name: string;
    name_ar?: string;
    description?: string;
    created_at: string;
}

export interface Branch {
    id: string;
    name: string;
    name_ar: string;
    address?: string;
    is_active?: boolean;
}

export interface Car {
    id: string;
    category_id?: string;
    branch_id?: string;
    plate_number?: string;
    name: string;
    name_ar?: string;
    model: string;
    year: number;
    color: string;
    daily_rate: number;
    features: string[];
    images: string[];
    status: 'available' | 'rented' | 'maintenance';
    created_at: string;
    updated_at: string;
    category?: Category;
    branches?: { branch_id: string }[];
    car_branches?: { branches: Branch }[]; // For joined queries
}

export interface Booking {
    id: string;
    car_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    start_date: string;
    end_date: string;
    pickup_time?: string;
    branch?: string;
    total_amount: number;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    notes?: string;
    national_id?: string;
    created_at: string;
    updated_at: string;
    car?: Car;
    booking_number?: number;
}

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    status: 'unread' | 'read' | 'archived';
    created_at: string;
}

export type UserRole = 'super_admin' | 'branch_manager' | 'staff';

export interface Employee {
    id: string;
    full_name: string;
    email?: string;
    role: UserRole;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    employee_branches?: { branch_id: string }[];
}

export interface EmployeeBranch {
    employee_id: string;
    branch_id: string;
}

export interface ApiResponse<T> {
    data?: T;
    error?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
