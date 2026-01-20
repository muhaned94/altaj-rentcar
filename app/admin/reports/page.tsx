"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { formatCurrency } from "@/lib/utils";
import { applyBranchFilter } from "@/lib/auth-helpers";
import {
    BarChart3,
    TrendingUp,
    Calendar,
    Car,
    DollarSign,
    Users,
    Clock,
    Loader2,
    ChevronDown,
    FileText,
    PieChart
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from "recharts";

interface ReportData {
    totalBookings: number;
    confirmedBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
    topCars: { name: string; count: number }[];
    topBranches: { name: string; count: number }[];
}

interface MonthlyStat {
    name: string;
    revenue: number;
    bookings: number;
}

type Period = "today" | "week" | "month" | "year";

export default function AdminReportsPage() {
    const { t, language, dir } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>("month");
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [rentedCars, setRentedCars] = useState<any[]>([]);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);

    useEffect(() => {
        fetchReportData();
        fetchRentedCars();
        fetchMonthlyStats();
    }, [period]);

    function getDateRange(period: Period): { start: Date; end: Date } {
        const now = new Date();
        const end = new Date(now);
        let start = new Date(now);

        switch (period) {
            case "today":
                start.setHours(0, 0, 0, 0);
                break;
            case "week":
                start.setDate(now.getDate() - 7);
                break;
            case "month":
                start.setMonth(now.getMonth() - 1);
                break;
            case "year":
                start.setFullYear(now.getFullYear() - 1);
                break;
        }

        return { start, end };
    }

    async function fetchReportData() {
        try {
            setLoading(true);
            const { start, end } = getDateRange(period);

            let query = supabase
                .from("bookings")
                .select("*, car:cars(name, name_ar), branch, branch_id")
                .gte("created_at", start.toISOString())
                .lte("created_at", end.toISOString());

            query = await applyBranchFilter(query, 'branch_id');
            const { data: bookings, error } = await query;

            if (error) throw error;

            const data = bookings || [];

            const confirmed = data.filter(b => b.status === "confirmed");
            const completed = data.filter(b => b.status === "completed");
            const cancelled = data.filter(b => b.status === "cancelled");
            const pending = data.filter(b => b.status === "pending");

            const paidBookings = [...confirmed, ...completed];
            const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

            // Top cars
            const carCounts: Record<string, { name: string; count: number }> = {};
            data.forEach(b => {
                const carName = language === "ar" && b.car?.name_ar ? b.car.name_ar : (b.car?.name || "Unknown");
                if (!carCounts[carName]) carCounts[carName] = { name: carName, count: 0 };
                carCounts[carName].count++;
            });
            const topCars = Object.values(carCounts).sort((a, b) => b.count - a.count).slice(0, 5);

            // Top branches
            const branchCounts: Record<string, { name: string; count: number }> = {};
            data.forEach(b => {
                const branch = b.branch || "Unknown";
                if (!branchCounts[branch]) branchCounts[branch] = { name: branch, count: 0 };
                branchCounts[branch].count++;
            });
            const topBranches = Object.values(branchCounts).sort((a, b) => b.count - a.count).slice(0, 5);

            setReportData({
                totalBookings: data.length,
                confirmedBookings: confirmed.length,
                completedBookings: completed.length,
                cancelledBookings: cancelled.length,
                pendingBookings: pending.length,
                totalRevenue,
                averageBookingValue: paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0,
                topCars,
                topBranches,
            });
        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchRentedCars() {
        try {
            // 1. Fetch ALL Rented Inventory (Source of Truth for Dashboard Count)
            // We fetch the inventory items that are marked as 'rented'
            const { data: inventoryData, error: invError } = await supabase
                .from("car_inventory")
                .select("*, car:cars!inner(*, category:categories(id, name, name_ar))")
                .eq("status", "rented");

            if (invError) throw invError;

            if (!inventoryData || inventoryData.length === 0) {
                setRentedCars([]);
                return;
            }

            // 2. Fetch associated confirmed bookings to get customer details
            // We get all confirmed bookings for these inventory IDs
            const inventoryIds = inventoryData.map(i => i.id);
            const { data: bookings, error: bookingError } = await supabase
                .from("bookings")
                .select("*")
                .in("inventory_id", inventoryIds)
                .eq("status", "confirmed")
                .order("created_at", { ascending: false });

            if (bookingError) throw bookingError;

            // 3. Merge Data
            const formattedCars = inventoryData.map(item => {
                // Find the listing booking. 
                // Since we might have multiple confirmed bookings (past/future?), we try to find one that overlaps NOW.
                // If not found, imply take the latest created one.
                const today = new Date().toISOString().split('T')[0];
                const activeBooking = bookings?.find(b =>
                    b.inventory_id === item.id &&
                    b.start_date <= today &&
                    b.end_date >= today
                ) || bookings?.find(b => b.inventory_id === item.id); // Fallback to any confirmed booking for this item

                return {
                    id: item.id,
                    plate_number: item.plate_number,
                    color: item.color,
                    booking_start: activeBooking?.start_date,
                    booking_end: activeBooking?.end_date,
                    customer_name: activeBooking?.customer_name || (language === "ar" ? "غير متوفر" : "N/A"),
                    branch: activeBooking?.branch || '-',
                    // car details
                    ...item.car
                };
            });

            setRentedCars(formattedCars);
        } catch (error) {
            console.error("Error fetching rented cars:", error);
        }
    }

    async function fetchMonthlyStats() {
        try {
            // Get data for the last 6 months
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 5);
            start.setDate(1); // Start from beginning of that month

            let query = supabase
                .from("bookings")
                .select("created_at, total_amount, status")
                .gte("created_at", start.toISOString())
                .lte("created_at", end.toISOString())
                .or("status.eq.confirmed,status.eq.completed");

            query = await applyBranchFilter(query, 'branch_id');
            const { data: bookings, error } = await query;

            if (error) throw error;

            // Group by month
            const stats: Record<string, { revenue: number; bookings: number }> = {};

            // Initialize last 6 months
            for (let i = 0; i < 6; i++) {
                const d = new Date(start);
                d.setMonth(d.getMonth() + i);
                const monthName = d.toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", { month: "short" });
                stats[monthName] = { revenue: 0, bookings: 0 };
            }

            bookings?.forEach(booking => {
                const date = new Date(booking.created_at);
                const monthName = date.toLocaleDateString(language === "ar" ? "ar-IQ" : "en-US", { month: "short" });

                // Only count if we initialized this month (handles edge cases)
                if (stats[monthName]) {
                    stats[monthName].revenue += booking.total_amount || 0;
                    stats[monthName].bookings += 1;
                }
            });

            const formattedStats = Object.entries(stats).map(([name, data]) => ({
                name,
                ...data
            }));

            setMonthlyStats(formattedStats);
        } catch (error) {
            console.error("Error fetching monthly stats:", error);
        }
    }

    const periodLabels = {
        today: language === "ar" ? "اليوم" : "Today",
        week: language === "ar" ? "الأسبوع" : "This Week",
        month: language === "ar" ? "الشهر" : "This Month",
        year: language === "ar" ? "السنة" : "This Year",
    };

    if (loading && !reportData) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white flex items-center gap-2">
                        <BarChart3 className="h-7 w-7 text-gold" />
                        {language === "ar" ? "التقارير" : "Reports"}
                    </h1>
                    <p className="text-luxury-white/60 mt-1">
                        {language === "ar" ? "تحليل الأداء والإحصائيات" : "Performance Analytics & Statistics"}
                    </p>
                </div>

                {/* Period Selector */}
                <div className="relative">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="appearance-none px-4 py-3 pr-10 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                    >
                        {Object.entries(periodLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gold pointer-events-none" />
                </div>
            </div>

            {reportData && (
                <>
                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Bookings */}
                        <div className="luxury-card bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-400 text-sm font-medium">
                                        {language === "ar" ? "إجمالي الحجوزات" : "Total Bookings"}
                                    </p>
                                    <p className="text-3xl font-bold text-luxury-white mt-2">{reportData.totalBookings}</p>
                                </div>
                                <div className="p-3 bg-blue-500/20 rounded-lg">
                                    <Calendar className="h-6 w-6 text-blue-400" />
                                </div>
                            </div>
                        </div>

                        {/* Total Revenue */}
                        <div className="luxury-card bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-400 text-sm font-medium">
                                        {language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}
                                    </p>
                                    <p className="text-3xl font-bold text-luxury-white mt-2">{formatCurrency(reportData.totalRevenue, language)}</p>
                                </div>
                                <div className="p-3 bg-green-500/20 rounded-lg">
                                    <DollarSign className="h-6 w-6 text-green-400" />
                                </div>
                            </div>
                        </div>

                        {/* Average Booking */}
                        <div className="luxury-card bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-400 text-sm font-medium">
                                        {language === "ar" ? "متوسط الحجز" : "Avg. Booking Value"}
                                    </p>
                                    <p className="text-3xl font-bold text-luxury-white mt-2">{formatCurrency(reportData.averageBookingValue, language)}</p>
                                </div>
                                <div className="p-3 bg-purple-500/20 rounded-lg">
                                    <TrendingUp className="h-6 w-6 text-purple-400" />
                                </div>
                            </div>
                        </div>

                        {/* Rented Cars */}
                        <div className="luxury-card bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-400 text-sm font-medium">
                                        {language === "ar" ? "سيارات مؤجرة حالياً" : "Currently Rented"}
                                    </p>
                                    <p className="text-3xl font-bold text-luxury-white mt-2">{rentedCars.length}</p>
                                </div>
                                <div className="p-3 bg-orange-500/20 rounded-lg">
                                    <Car className="h-6 w-6 text-orange-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Revenue Chart */}
                        <div className="luxury-card">
                            <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-gold" />
                                {language === "ar" ? "تحليل الإيرادات (آخر 6 أشهر)" : "Revenue Analytics (Last 6 Months)"}
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyStats}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#666"
                                            tick={{ fill: '#888' }}
                                            axisLine={{ stroke: '#333' }}
                                        />
                                        <YAxis
                                            stroke="#666"
                                            tick={{ fill: '#888' }}
                                            axisLine={{ stroke: '#333' }}
                                            tickFormatter={(value) => `$${value / 1000}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                                            itemStyle={{ color: '#D4AF37' }}
                                            formatter={(value: any) => [formatCurrency(value, language), language === "ar" ? "الإيرادات" : "Revenue"]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#D4AF37"
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bookings Chart */}
                        <div className="luxury-card">
                            <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-gold" />
                                {language === "ar" ? "اتجاهات الحجوزات" : "Booking Trends"}
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyStats}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#666"
                                            tick={{ fill: '#888' }}
                                            axisLine={{ stroke: '#333' }}
                                        />
                                        <YAxis
                                            stroke="#666"
                                            tick={{ fill: '#888' }}
                                            axisLine={{ stroke: '#333' }}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                            cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }}
                                            formatter={(value: any) => [value, language === "ar" ? "حجز" : "Bookings"]}
                                        />
                                        <Bar
                                            dataKey="bookings"
                                            fill="#D4AF37"
                                            radius={[4, 4, 0, 0]}
                                            barSize={40}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Booking Status Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Status Distribution */}
                        <div className="luxury-card">
                            <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-gold" />
                                {language === "ar" ? "توزيع حالات الحجز" : "Booking Status Distribution"}
                            </h3>
                            <div className="space-y-4">
                                {/* Pending */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-yellow-400 text-sm">{language === "ar" ? "قيد الانتظار" : "Pending"}</span>
                                        <span className="text-luxury-white font-medium">{reportData.pendingBookings}</span>
                                    </div>
                                    <div className="h-2 bg-luxury-gray rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-yellow-500 rounded-full"
                                            style={{ width: `${reportData.totalBookings > 0 ? (reportData.pendingBookings / reportData.totalBookings) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Confirmed */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-blue-400 text-sm">{language === "ar" ? "مؤكد" : "Confirmed"}</span>
                                        <span className="text-luxury-white font-medium">{reportData.confirmedBookings}</span>
                                    </div>
                                    <div className="h-2 bg-luxury-gray rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${reportData.totalBookings > 0 ? (reportData.confirmedBookings / reportData.totalBookings) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Completed */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-green-400 text-sm">{language === "ar" ? "مكتمل" : "Completed"}</span>
                                        <span className="text-luxury-white font-medium">{reportData.completedBookings}</span>
                                    </div>
                                    <div className="h-2 bg-luxury-gray rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${reportData.totalBookings > 0 ? (reportData.completedBookings / reportData.totalBookings) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Cancelled */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-red-400 text-sm">{language === "ar" ? "ملغي" : "Cancelled"}</span>
                                        <span className="text-luxury-white font-medium">{reportData.cancelledBookings}</span>
                                    </div>
                                    <div className="h-2 bg-luxury-gray rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full"
                                            style={{ width: `${reportData.totalBookings > 0 ? (reportData.cancelledBookings / reportData.totalBookings) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Cars */}
                        <div className="luxury-card">
                            <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                <Car className="h-5 w-5 text-gold" />
                                {language === "ar" ? "أكثر السيارات حجزاً" : "Top Booked Cars"}
                            </h3>
                            {reportData.topCars.length > 0 ? (
                                <div className="space-y-3">
                                    {reportData.topCars.map((car, index) => (
                                        <div key={car.name} className="flex items-center justify-between p-3 bg-luxury-gray/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? "bg-gold text-luxury-black" :
                                                    index === 1 ? "bg-gray-400 text-luxury-black" :
                                                        index === 2 ? "bg-amber-700 text-luxury-white" :
                                                            "bg-luxury-gray text-luxury-white"
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                <span className="text-luxury-white font-medium">{car.name}</span>
                                            </div>
                                            <span className="text-gold font-bold">{car.count} {language === "ar" ? "حجز" : "bookings"}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-luxury-white/60 text-center py-8">
                                    {language === "ar" ? "لا توجد بيانات" : "No data available"}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Top Branches */}
                    <div className="luxury-card">
                        <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5 text-gold" />
                            {language === "ar" ? "أكثر الفروع نشاطاً" : "Most Active Branches"}
                        </h3>
                        {reportData.topBranches.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {reportData.topBranches.map((branch, index) => (
                                    <div key={branch.name} className="p-4 bg-luxury-gray/50 rounded-lg border border-gold/10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? "bg-gold text-luxury-black" : "bg-luxury-gray text-luxury-white"
                                                }`}>
                                                {index + 1}
                                            </span>
                                            <span className="text-luxury-white font-medium">{branch.name}</span>
                                        </div>
                                        <p className="text-gold text-2xl font-bold">{branch.count}</p>
                                        <p className="text-luxury-white/60 text-sm">{language === "ar" ? "حجوزات" : "bookings"}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-luxury-white/60 text-center py-8">
                                {language === "ar" ? "لا توجد بيانات" : "No data available"}
                            </p>
                        )}
                    </div>

                    {/* Currently Rented Cars */}
                    <div className="luxury-card">
                        <h3 className="text-lg font-semibold text-luxury-white mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-gold" />
                            {language === "ar" ? "السيارات المؤجرة حالياً" : "Currently Rented Cars"}
                            {rentedCars.length > 0 && (
                                <span className="text-orange-400 text-sm">({rentedCars.length})</span>
                            )}
                        </h3>
                        {rentedCars.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {rentedCars.map((car, idx) => (
                                    <div key={`${car.id}-${idx}`} className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Car className="h-5 w-5 text-orange-400" />
                                            <span className="text-luxury-white font-medium">
                                                {language === "ar" && car.name_ar ? car.name_ar : car.name}
                                            </span>
                                        </div>
                                        <p className="text-luxury-white/60 text-sm">{car.model} • {car.year}</p>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-xs bg-luxury-black/40 px-2 py-1 rounded text-gold border border-gold/10 font-mono tracking-wider">
                                                {car.plate_number}
                                            </span>
                                            {car.category && (
                                                <p className="text-orange-400 text-sm">
                                                    {language === "ar" && car.category?.name_ar ? car.category.name_ar : car.category?.name}
                                                </p>
                                            )}
                                        </div>
                                        {/* Booking Info */}
                                        <div className="mt-3 pt-3 border-t border-orange-500/20 space-y-1">
                                            {car.customer_name && (
                                                <p className="text-luxury-white/80 text-xs flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {car.customer_name}
                                                </p>
                                            )}
                                            {car.booking_start && car.booking_end && (
                                                <p className="text-luxury-white/60 text-xs flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(car.booking_start).toLocaleDateString(language === "ar" ? 'ar-IQ' : 'en-US')} - {new Date(car.booking_end).toLocaleDateString(language === "ar" ? 'ar-IQ' : 'en-US')}
                                                </p>
                                            )}
                                            {car.branch && (
                                                <p className="text-luxury-white/60 text-xs">{car.branch}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Car className="h-12 w-12 text-green-500/50 mx-auto mb-3" />
                                <p className="text-green-400 font-medium">
                                    {language === "ar" ? "جميع السيارات متاحة!" : "All cars are available!"}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
