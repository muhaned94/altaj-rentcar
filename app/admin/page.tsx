"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { formatCurrency } from "@/lib/utils";
import { applyBranchFilter } from "@/lib/auth-helpers";
import {
    Car,
    Calendar,
    DollarSign,
    TrendingUp,
    Clock,
    ArrowRight,
    Loader2,
    Users,
    CheckCircle,
    AlertCircle,
    BarChart3,
    MapPin,
    Folder
} from "lucide-react";

interface DashboardStats {
    totalCars: number;
    availableCars: number;
    rentedCars: number;
    totalBookings: number;
    pendingBookings: number;
    confirmedBookings: number;
    completedBookings: number;
    totalRevenue: number;
    todayBookings: number;
    totalBranches: number;
    totalCategories: number;
}

interface RecentBooking {
    id: string;
    customer_name: string;
    start_date: string;
    end_date: string;
    total_amount: number;
    status: string;
    branch?: string;
    created_at: string;
    car: { name: string; name_ar?: string } | null;
}

export default function AdminDashboard() {
    const { t, language, dir } = useLanguage();
    const [stats, setStats] = useState<DashboardStats>({
        totalCars: 0,
        availableCars: 0,
        rentedCars: 0,
        totalBookings: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0,
        totalRevenue: 0,
        todayBookings: 0,
        totalBranches: 0,
        totalCategories: 0,
    });
    const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();

        // 1. Subscribe to bookings changes
        const bookingsChannel = supabase
            .channel('dashboard-bookings-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                () => {
                    fetchDashboardData(true);
                }
            )
            .subscribe();

        // 2. Subscribe to cars changes
        const carsChannel = supabase
            .channel('dashboard-cars-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cars' },
                () => {
                    fetchDashboardData(true);
                }
            )
            .subscribe();

        // 3. Fallback polling every 10 seconds
        const intervalId = setInterval(() => {
            fetchDashboardData(true);
        }, 10000);

        return () => {
            supabase.removeChannel(bookingsChannel);
            supabase.removeChannel(carsChannel);
            clearInterval(intervalId);
        };
    }, []);

    async function fetchDashboardData(silent = false) {
        try {
            if (!silent) setLoading(true);

            // Helper function to safely run a query and suppress RLS-related empty result errors
            async function safeQuery<T>(queryFn: () => Promise<{ data: T | null, error: any, count?: number | null }>): Promise<{ data: T | null, count: number }> {
                try {
                    const result = await queryFn();
                    if (result.error && result.error.code !== 'PGRST116') { // Ignore "No rows found" errors
                        console.warn("Query warning:", result.error.message);
                    }
                    return { data: result.data, count: result.count ?? 0 };
                } catch (e) {
                    return { data: null, count: 0 };
                }
            }

            // Fetch allowed cars first (Branch Filter)
            const { data: allowedCars } = await safeQuery(async () => {
                let q = supabase.from("cars").select("id, car_branches!inner(branch_id)");
                return await applyBranchFilter(q, 'car_branches.branch_id');
            });
            const carIds = allowedCars ? (allowedCars as any[]).map(c => c.id) : [];

            // Fetch Inventory Stats based on allowed cars
            const { count: totalCars } = carIds.length > 0 ? await safeQuery(async () =>
                await supabase.from("car_inventory").select("id", { count: "exact", head: true })
                    .in("car_id", carIds)
                    .neq("status", "maintenance")
            ) : { count: 0 };

            const { count: availableCars } = carIds.length > 0 ? await safeQuery(async () =>
                await supabase.from("car_inventory").select("id", { count: "exact", head: true })
                    .in("car_id", carIds)
                    .eq("status", "available")
            ) : { count: 0 };

            const { count: rentedCars } = carIds.length > 0 ? await safeQuery(async () =>
                await supabase.from("car_inventory").select("id", { count: "exact", head: true })
                    .in("car_id", carIds)
                    .eq("status", "rented")
            ) : { count: 0 };

            // Fetch bookings stats
            const { count: totalBookings } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("id", { count: "exact", head: true }), 'branch_id'));
            const { count: pendingBookings } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"), 'branch_id'));
            const { count: confirmedBookings } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed"), 'branch_id'));
            const { count: completedBookings } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"), 'branch_id'));

            // Today's bookings
            const today = new Date().toISOString().split('T')[0];
            const { count: todayBookings } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", today), 'branch_id'));

            // Branches and categories count (no filter, these are global)
            const { count: totalBranches } = await supabase.from("branches").select("id", { count: "exact", head: true });
            const { count: totalCategories } = await supabase.from("categories").select("id", { count: "exact", head: true });

            // Fetch total revenue
            const { data: revenueData } = await safeQuery(() => applyBranchFilter(supabase.from("bookings").select("total_amount").in("status", ["confirmed", "completed"]), 'branch_id'));
            const totalRevenue = (revenueData as any[])?.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0) || 0;

            // Fetch recent bookings
            const { data: bookings } = await safeQuery(() => applyBranchFilter(supabase
                .from("bookings")
                .select("id, customer_name, start_date, end_date, total_amount, status, branch, branch_id, created_at, car:cars(name, name_ar)")
                .order("created_at", { ascending: false })
                .limit(5), 'branch_id'));

            setStats({
                totalCars: totalCars || 0,
                availableCars: availableCars || 0,
                rentedCars: rentedCars || 0,
                totalBookings: totalBookings || 0,
                pendingBookings: pendingBookings || 0,
                confirmedBookings: confirmedBookings || 0,
                completedBookings: completedBookings || 0,
                totalRevenue,
                todayBookings: todayBookings || 0,
                totalBranches: totalBranches || 0,
                totalCategories: totalCategories || 0,
            });

            setRecentBookings((bookings as unknown as RecentBooking[]) || []);
        } catch (error) {
            console.error("Dashboard data fetch exception:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
            case "confirmed":
                return "bg-blue-500/20 text-blue-400 border-blue-500/30";
            case "completed":
                return "bg-green-500/20 text-green-400 border-green-500/30";
            default:
                return "bg-red-500/20 text-red-400 border-red-500/30";
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: language === "ar" ? "قيد الانتظار" : "Pending",
            confirmed: language === "ar" ? "مؤكد" : "Confirmed",
            completed: language === "ar" ? "مكتمل" : "Completed",
            cancelled: language === "ar" ? "ملغي" : "Cancelled",
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* Welcome Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-luxury-white">
                        {t("admin.welcome")} <span className="text-gold">{t("admin.welcomeHighlight")}</span>
                    </h1>
                    <p className="text-luxury-white/60 mt-2">
                        {t("admin.manageFleet")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/bookings/new"
                        className="btn-gold flex items-center gap-2"
                    >
                        <Calendar className="h-5 w-5" />
                        <span>{language === "ar" ? "حجز سريع" : "Quick Booking"}</span>
                    </Link>
                    {stats.pendingBookings > 0 && (
                        <Link href="/admin/bookings" className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 hover:bg-yellow-500/30 transition-colors">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-medium">
                                {stats.pendingBookings} {language === "ar" ? "حجز جديد" : "pending bookings"}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Total Cars */}
                <div className="luxury-card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Car className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.totalCars}</p>
                            <p className="text-blue-400 text-xs">{t("admin.totalCars")}</p>
                        </div>
                    </div>
                </div>

                {/* Available Cars */}
                <div className="luxury-card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.availableCars}</p>
                            <p className="text-green-400 text-xs">{t("admin.availableCars")}</p>
                        </div>
                    </div>
                </div>

                {/* Rented Cars */}
                <div className="luxury-card bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Car className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.rentedCars}</p>
                            <p className="text-orange-400 text-xs">{language === "ar" ? "مؤجرة" : "Rented"}</p>
                        </div>
                    </div>
                </div>

                {/* Total Bookings */}
                <div className="luxury-card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Calendar className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.totalBookings}</p>
                            <p className="text-purple-400 text-xs">{t("admin.totalBookings")}</p>
                        </div>
                    </div>
                </div>

                {/* Pending */}
                <div className="luxury-card bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Clock className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.pendingBookings}</p>
                            <p className="text-yellow-400 text-xs">{t("admin.pending")}</p>
                        </div>
                    </div>
                </div>

                {/* Today */}
                <div className="luxury-card bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-luxury-white">{stats.todayBookings}</p>
                            <p className="text-cyan-400 text-xs">{language === "ar" ? "اليوم" : "Today"}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Revenue Card */}
            <div className="luxury-card bg-gold-gradient">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-luxury-black/60 text-sm font-medium">{t("admin.totalRevenue")}</p>
                        <p className="text-3xl sm:text-4xl font-bold text-luxury-black mt-1">
                            {formatCurrency(stats.totalRevenue, language)}
                        </p>
                        <p className="text-luxury-black/60 text-sm mt-2">
                            {t("admin.revenueNote")}
                        </p>
                    </div>
                    <div className="p-4 rounded-full bg-luxury-black/10">
                        <DollarSign className="h-8 w-8 text-luxury-black" />
                    </div>
                </div>
            </div>

            {/* Recent Bookings & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Bookings */}
                <div className="lg:col-span-2 luxury-card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-luxury-white">{t("admin.recentBookings")}</h2>
                        <Link
                            href="/admin/bookings"
                            className="text-gold hover:text-gold-light text-sm flex items-center gap-1"
                        >
                            {t("admin.viewAll")} <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {recentBookings.length === 0 ? (
                        <p className="text-luxury-white/60 text-center py-8">
                            {t("admin.noBookingsYet")}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {recentBookings.map((booking) => (
                                <div key={booking.id} className="p-4 bg-luxury-gray/50 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Users className="h-4 w-4 text-gold" />
                                                <span className="text-luxury-white font-medium">{booking.customer_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-luxury-white/60">
                                                <Car className="h-3 w-3" />
                                                <span>{language === "ar" && booking.car?.name_ar ? booking.car.name_ar : booking.car?.name || "N/A"}</span>
                                            </div>
                                            {booking.branch && (
                                                <div className="flex items-center gap-2 text-sm text-luxury-white/60 mt-1">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>{booking.branch}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(booking.status)}`}>
                                                {getStatusLabel(booking.status)}
                                            </span>
                                            <p className="text-gold font-bold mt-2">{formatCurrency(booking.total_amount, language)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Stats Sidebar */}
                <div className="space-y-4">
                    {/* Booking Status Summary */}
                    <div className="luxury-card">
                        <h3 className="text-lg font-semibold text-luxury-white mb-4">
                            {language === "ar" ? "ملخص الحجوزات" : "Booking Summary"}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-yellow-400 text-sm">{language === "ar" ? "قيد الانتظار" : "Pending"}</span>
                                <span className="text-luxury-white font-bold">{stats.pendingBookings}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-blue-400 text-sm">{language === "ar" ? "مؤكد" : "Confirmed"}</span>
                                <span className="text-luxury-white font-bold">{stats.confirmedBookings}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-green-400 text-sm">{language === "ar" ? "مكتمل" : "Completed"}</span>
                                <span className="text-luxury-white font-bold">{stats.completedBookings}</span>
                            </div>
                        </div>
                    </div>

                    {/* System Info */}
                    <div className="luxury-card">
                        <h3 className="text-lg font-semibold text-luxury-white mb-4">
                            {language === "ar" ? "معلومات النظام" : "System Info"}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-luxury-white/60 text-sm flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-gold" />
                                    {t("admin.branches")}
                                </span>
                                <span className="text-luxury-white font-bold">{stats.totalBranches}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-luxury-white/60 text-sm flex items-center gap-2">
                                    <Folder className="h-4 w-4 text-gold" />
                                    {t("admin.categories")}
                                </span>
                                <span className="text-luxury-white font-bold">{stats.totalCategories}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Link href="/admin/cars/new" className="luxury-card hover:border-gold/50 group text-center">
                    <Car className="h-8 w-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="text-luxury-white font-medium">{t("admin.addNewCar")}</h3>
                </Link>

                <Link href="/admin/bookings" className="luxury-card hover:border-gold/50 group text-center">
                    <Calendar className="h-8 w-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="text-luxury-white font-medium">{t("admin.manageBookings")}</h3>
                </Link>

                <Link href="/admin/branches" className="luxury-card hover:border-gold/50 group text-center">
                    <MapPin className="h-8 w-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="text-luxury-white font-medium">{t("admin.branches")}</h3>
                </Link>

                <Link href="/admin/reports" className="luxury-card hover:border-gold/50 group text-center">
                    <BarChart3 className="h-8 w-8 text-gold mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h3 className="text-luxury-white font-medium">{language === "ar" ? "التقارير" : "Reports"}</h3>
                </Link>
            </div>
        </div>
    );
}
