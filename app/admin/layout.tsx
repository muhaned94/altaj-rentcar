"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { supabase } from "@/lib/supabase";
import LanguageSwitcher from "@/components/language-switcher";
import {
    Crown,
    LayoutDashboard,
    Car,
    Calendar,
    Folder,
    MapPin,
    Menu,
    Mail,
    X,
    ChevronLeft,
    LogOut,
    Bell,
    BarChart3,
    CalendarRange,
    Users,
    ScrollText,
    Shield,
    Loader2
} from "lucide-react";
import NotificationsPopover from "@/components/admin/notifications-popover";
import { getCurrentEmployee, clearEmployeeCache, applyBranchFilter } from "@/lib/auth-helpers";
import { Employee } from "@/lib/types";

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const { t, language, dir } = useLanguage();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [employeeLoading, setEmployeeLoading] = useState(true);

    useEffect(() => {
        // Fetch current employee first to ensure branch filtering works
        const init = async () => {
            await fetchEmployee();
            fetchPendingBookings();
            fetchUnreadMessages();
        };

        init();

        // Listen for auth state changes (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Clear cache and re-fetch employee on sign in
                clearEmployeeCache();
                fetchEmployee().then(() => {
                    fetchPendingBookings();
                    fetchUnreadMessages();
                });
            } else if (event === 'SIGNED_OUT') {
                setEmployee(null);
            }
        });

        // 1. Subscribe to new bookings
        const channel = supabase
            .channel('layout-bookings-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                async (payload: any) => {
                    const emp = await getCurrentEmployee();
                    if (!emp) return;

                    // Only refresh if super_admin OR booking belongs to admin's branch
                    const isSuperAdmin = emp.role === 'super_admin';
                    const bookingBranchId = payload.new ? payload.new.branch_id : payload.old?.branch_id;
                    const isMyBranch = emp.employee_branches?.some(eb => eb.branch_id === bookingBranchId);

                    if (isSuperAdmin || isMyBranch) {
                        fetchPendingBookings();
                        // Optional: play sound here if you want it globally in layout
                    }
                }
            )
            .subscribe();

        // 2. Subscribe to new messages
        const messagesChannel = supabase
            .channel('layout-messages-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'contact_messages' },
                () => {
                    fetchUnreadMessages();
                }
            )
            .subscribe();

        // 3. Poll every 10 seconds (Fallback)
        const intervalId = setInterval(() => {
            fetchPendingBookings();
            fetchUnreadMessages();
        }, 10000);

        return () => {
            subscription.unsubscribe();
            supabase.removeChannel(channel);
            supabase.removeChannel(messagesChannel);
            clearInterval(intervalId);
        };
    }, []);

    async function fetchEmployee() {
        setEmployeeLoading(true);
        // Clear cache first to ensure fresh data
        clearEmployeeCache();

        let emp = await getCurrentEmployee();

        // If no employee found, retry after a short delay (for new logins)
        if (!emp) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            clearEmployeeCache();
            emp = await getCurrentEmployee();
        }

        setEmployee(emp);
        setEmployeeLoading(false);
    }

    async function fetchPendingBookings() {
        try {
            let query = supabase
                .from("bookings")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending");

            // Apply branch filter
            query = await applyBranchFilter(query, 'branch_id');

            const { count } = await query;

            setPendingCount(count || 0);
        } catch (error) {
            console.error("Error fetching pending count:", error);
        }
    }

    async function fetchUnreadMessages() {
        try {
            const { count } = await supabase
                .from("contact_messages")
                .select("*", { count: "exact", head: true })
                .eq("status", "unread");

            setUnreadMessages(count || 0);
        } catch (error) {
            console.error("Error fetching unread count:", error);
        }
    }

    // If on login page, just render children without the layout wrapper
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // If employee is loaded and not active, sign out and redirect to login
    if (!employeeLoading && employee && !employee.is_active) {
        supabase.auth.signOut().then(() => {
            window.location.href = "/admin/login?error=account_inactive";
        });
        return (
            <div className="min-h-screen bg-luxury-black flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 text-gold animate-spin mx-auto mb-4" />
                    <p className="text-luxury-white">
                        {language === "ar" ? "الحساب معطل..." : "Account is inactive..."}
                    </p>
                </div>
            </div>
        );
    }

    // If no employee found after loading (not authorized), redirect to login
    if (!employeeLoading && !employee) {
        return (
            <div className="min-h-screen bg-luxury-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 text-gold animate-spin mx-auto" />
                    <p className="text-luxury-white/60">
                        {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </p>
                </div>
            </div>
        );
    }

    // Page-level access control
    const pageAccessRules: Record<string, string[]> = {
        '/admin': ['staff', 'branch_manager', 'super_admin'],
        '/admin/cars': ['staff', 'branch_manager', 'super_admin'],
        '/admin/bookings': ['staff', 'branch_manager', 'super_admin'],
        '/admin/calendar': ['staff', 'branch_manager', 'super_admin'],
        '/admin/customers': ['branch_manager', 'super_admin'],
        '/admin/reports': ['branch_manager', 'super_admin'],
        '/admin/categories': ['super_admin'],
        '/admin/branches': ['super_admin'],
        '/admin/users': ['super_admin'],
        '/admin/messages': ['super_admin'],
        '/admin/logs': ['super_admin'],
    };

    // Check if current page is accessible
    if (!employeeLoading && employee) {
        // Find the matching rule for current path
        const matchingPath = Object.keys(pageAccessRules).find(path =>
            pathname === path || pathname.startsWith(path + '/')
        );

        if (matchingPath && !pageAccessRules[matchingPath].includes(employee.role)) {
            return (
                <div className="min-h-screen bg-luxury-black flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <Shield className="h-16 w-16 text-red-500 mx-auto" />
                        <h1 className="text-2xl font-bold text-luxury-white">
                            {language === "ar" ? "غير مصرح" : "Unauthorized"}
                        </h1>
                        <p className="text-luxury-white/60">
                            {language === "ar"
                                ? "ليس لديك صلاحية للوصول لهذه الصفحة"
                                : "You don't have permission to access this page"}
                        </p>
                        <Link href="/admin" className="btn-gold inline-block mt-4">
                            {language === "ar" ? "العودة للرئيسية" : "Go to Dashboard"}
                        </Link>
                    </div>
                </div>
            );
        }
    }

    // Role-based navigation:
    // - staff: Dashboard, Cars, Bookings, Calendar
    // - branch_manager: Above + Reports, Customers
    // - super_admin: All pages
    const navItems = [
        { href: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard, badge: 0, roles: ['staff', 'branch_manager', 'super_admin'] },
        { href: "/admin/cars", label: t("admin.cars"), icon: Car, badge: 0, roles: ['staff', 'branch_manager', 'super_admin'] },
        { href: "/admin/bookings", label: t("admin.bookings"), icon: Calendar, badge: pendingCount, roles: ['staff', 'branch_manager', 'super_admin'] },
        { href: "/admin/calendar", label: t("admin.calendar"), icon: CalendarRange, badge: 0, roles: ['staff', 'branch_manager', 'super_admin'] },
        { href: "/admin/customers", label: t("admin.crm"), icon: Users, badge: 0, roles: ['branch_manager', 'super_admin'] },
        { href: "/admin/reports", label: language === "ar" ? "التقارير" : "Reports", icon: BarChart3, badge: 0, roles: ['branch_manager', 'super_admin'] },
        { href: "/admin/categories", label: t("admin.categories"), icon: Folder, badge: 0, roles: ['super_admin'] },
        { href: "/admin/branches", label: t("admin.branches"), icon: MapPin, badge: 0, roles: ['super_admin'] },
        { href: "/admin/users", label: t("admin.userManagement"), icon: Shield, badge: 0, roles: ['super_admin'] },
        { href: "/admin/messages", label: language === "ar" ? "الرسائل" : "Messages", icon: Mail, badge: unreadMessages, roles: ['super_admin'] },
        { href: "/admin/logs", label: language === "ar" ? "سجل النشاطات" : "Audit Logs", icon: ScrollText, badge: 0, roles: ['super_admin'] },
    ].filter(item => {
        // If still loading, show basic items only
        if (employeeLoading) return item.roles?.includes('staff');
        // Once loaded, filter based on role
        return employee && item.roles?.includes(employee.role);
    });

    return (
        <div className="min-h-screen bg-luxury-black" dir={dir}>
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 ${dir === "rtl" ? "right-0" : "left-0"} h-full bg-luxury-gray border-${dir === "rtl" ? "l" : "r"} border-gold/20 z-50 transition-all duration-300 print:hidden ${sidebarOpen
                    ? "translate-x-0"
                    : dir === "rtl"
                        ? "translate-x-full lg:translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                    } ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"} w-64`}
            >
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gold/20">
                    <Link href="/admin" className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gold/10">
                            <Crown className="h-6 w-6 text-gold" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="hidden lg:block">
                                <span className="text-gold font-bold">Al-Taj</span>
                                <span className="text-luxury-white/60 text-xs block">Admin Panel</span>
                            </div>
                        )}
                    </Link>

                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-luxury-white/60 hover:text-gold"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="hidden lg:block p-2 text-luxury-white/60 hover:text-gold transition-colors"
                    >
                        <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""} ${dir === "rtl" ? "rotate-180" : ""}`} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== "/admin" && pathname.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative ${isActive
                                    ? "bg-gold/20 text-gold border border-gold/30"
                                    : "text-luxury-white/70 hover:bg-gold/10 hover:text-gold"
                                    } ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
                            >
                                <div className="relative">
                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                    {item.badge > 0 && (
                                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full px-1">
                                            {item.badge > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
                                </div>
                                {!sidebarCollapsed && (
                                    <span className="font-medium flex-1">{item.label}</span>
                                )}
                                {!sidebarCollapsed && item.badge > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {item.badge > 99 ? "99+" : item.badge} {t("admin.newBookings")}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gold/20">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.href = "/admin/login";
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-luxury-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""
                            }`}
                    >
                        <LogOut className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span>{language === "ar" ? "تسجيل الخروج" : "Logout"}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div
                className={`transition-all duration-300 
                    ${dir === "rtl"
                        ? (sidebarCollapsed ? "lg:mr-20" : "lg:mr-64")
                        : (sidebarCollapsed ? "lg:ml-20" : "lg:ml-64")
                    }
                `}
            >
                {/* Top Bar */}
                <header className="h-16 bg-luxury-gray/50 backdrop-blur-md border-b border-gold/20 sticky top-0 z-30 print:hidden">
                    <div className="h-full px-4 flex items-center justify-between">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-luxury-white/60 hover:text-gold relative"
                        >
                            <Menu className="h-6 w-6" />
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full">
                                    {pendingCount > 99 ? "99+" : pendingCount}
                                </span>
                            )}
                        </button>

                        {/* Page Title - Desktop */}
                        <div className="hidden lg:block">
                            <h1 className="text-xl font-semibold text-luxury-white">
                                {navItems.find((item) =>
                                    pathname === item.href ||
                                    (item.href !== "/admin" && pathname.startsWith(item.href))
                                )?.label || t("admin.dashboard")}
                            </h1>
                        </div>

                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center gap-2">
                            <Crown className="h-5 w-5 text-gold" />
                            <span className="text-gold font-bold">Al-Taj</span>
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-4">
                            {/* Notification Bell */}
                            <NotificationsPopover />

                            <LanguageSwitcher />

                            <Link
                                href="/"
                                target="_blank"
                                className="hidden sm:block text-sm text-luxury-white/60 hover:text-gold transition-colors"
                            >
                                {t("admin.viewSite")} →
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
