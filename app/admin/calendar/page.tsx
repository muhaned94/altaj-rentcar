"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { applyBranchFilter, getAllowedBranchIds } from "@/lib/auth-helpers";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Search, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO, isSameDay } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Car {
    id: string;
    name: string;
    name_ar: string;
    model: string;
    plate_number: string;
}

interface Booking {
    id: string;
    start_date: string;
    end_date: string;
    customer_name: string;
    status: string;
    car_id: string;
}

interface Branch {
    id: string;
    name: string;
    name_ar: string;
}

export default function CalendarPage() {
    const { t, language, dir } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [cars, setCars] = useState<Car[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");

    // Generate days for the current month
    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
    });

    async function fetchBranches() {
        try {
            // Get employee's allowed branch IDs
            const allowedBranchIds = await getAllowedBranchIds();

            let query = supabase
                .from("branches")
                .select("*")
                .eq("is_active", true)
                .order("name");

            // If not super_admin (allowedBranchIds is not null), filter by allowed branches
            if (allowedBranchIds !== null && allowedBranchIds.length > 0) {
                query = query.in("id", allowedBranchIds);
            } else if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                // User has no branches assigned, don't show any
                setBranches([]);
                return;
            }

            const { data } = await query;
            if (data) setBranches(data);
        } catch (err) {
            console.error("Error fetching branches:", err);
        }
    }

    async function fetchData(silent = false) {
        try {
            if (!silent) setLoading(true);

            // Get allowed branch IDs for RBAC
            const allowedBranchIds = await getAllowedBranchIds();

            // 1. Fetch Cars with branch filter
            let carsQuery = supabase
                .from("cars")
                .select("*, car_branches!inner(branch_id)")
                .order("name");

            // Apply branch filter for cars
            if (selectedBranchId) {
                // User selected a specific branch
                carsQuery = carsQuery.eq("car_branches.branch_id", selectedBranchId);
            } else if (allowedBranchIds !== null && allowedBranchIds.length > 0) {
                // RBAC filter - only show cars from allowed branches
                carsQuery = carsQuery.in("car_branches.branch_id", allowedBranchIds);
            } else if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                // No branches assigned - use impossible filter
                carsQuery = carsQuery.in("car_branches.branch_id", ['00000000-0000-0000-0000-000000000000']);
            }
            // If allowedBranchIds is null (super_admin), show all cars

            const { data: carsData, error: carsError } = await carsQuery;
            if (carsError) throw carsError;

            // 2. Fetch Bookings for this month with branch filter
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            let bookingsQuery = supabase
                .from("bookings")
                .select("id, start_date, end_date, customer_name, status, car_id, branch_id")
                .neq("status", "cancelled")
                .lte("start_date", end)
                .gte("end_date", start);

            // Apply branch filter for bookings
            if (selectedBranchId) {
                bookingsQuery = bookingsQuery.eq("branch_id", selectedBranchId);
            } else if (allowedBranchIds !== null && allowedBranchIds.length > 0) {
                bookingsQuery = bookingsQuery.in("branch_id", allowedBranchIds);
            } else if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                bookingsQuery = bookingsQuery.in("branch_id", ['00000000-0000-0000-0000-000000000000']);
            }

            const { data: bookingsData, error: bookingsError } = await bookingsQuery;
            if (bookingsError) throw bookingsError;

            setCars(carsData || []);
            setBookings(bookingsData || []);

        } catch (error) {
            console.error("Error fetching calendar data:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    // Initial fetch and branches
    useEffect(() => {
        fetchBranches();
    }, []);

    // Data fetch with real-time subscription
    useEffect(() => {
        fetchData();

        // Real-time subscription for bookings changes
        const channel = supabase
            .channel('calendar-bookings-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                async (payload: any) => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;

                    // Fetch employee to check branch
                    const { data: emp } = await supabase
                        .from('employees')
                        .select('role, employee_branches(branch_id)')
                        .eq('id', session.user.id)
                        .single();

                    if (!emp) return;

                    const isSuperAdmin = emp.role === 'super_admin';
                    const bookingBranchId = payload.new ? payload.new.branch_id : payload.old?.branch_id;
                    const isMyBranch = (emp as any).employee_branches?.some((eb: any) => eb.branch_id === bookingBranchId);

                    if (isSuperAdmin || isMyBranch) {
                        console.log('Calendar: Relevant booking change detected, refreshing...');
                        fetchData(true);
                    }
                }
            )
            .subscribe();

        // Fallback polling every 5 seconds for faster updates
        const intervalId = setInterval(() => {
            fetchData(true);
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, [currentDate, selectedBranchId]);


    const filteredCars = cars.filter(car =>
        car.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (car.name_ar && car.name_ar.includes(searchTerm))
    );

    const getBookingStyle = (booking: Booking) => {
        let bgColor = "bg-blue-500";
        let borderColor = "border-blue-600";

        if (booking.status === "pending") {
            bgColor = "bg-yellow-500/80";
            borderColor = "border-yellow-600";
        } else if (booking.status === "confirmed") {
            bgColor = "bg-green-500";
            borderColor = "border-green-600";
        } else if (booking.status === "completed") {
            bgColor = "bg-gray-500";
            borderColor = "border-gray-600";
        } else if (booking.status === "cancelled") {
            bgColor = "bg-red-500/50";
            borderColor = "border-red-600";
        }

        return `${bgColor} border ${borderColor} text-white`;
    };

    const getBookingPosition = (booking: Booking, dayWidth: number) => {
        const monthStart = startOfMonth(currentDate);
        const bookingStart = parseISO(booking.start_date);
        const bookingEnd = parseISO(booking.end_date);

        // Calculate start offset
        let startIndex = 0;
        if (bookingStart > monthStart) {
            startIndex = Math.ceil((bookingStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
        } else {
            startIndex = 0;
        }

        const monthEnd = endOfMonth(currentDate);
        const effectiveStart = bookingStart < monthStart ? monthStart : bookingStart;
        const effectiveEnd = bookingEnd > monthEnd ? monthEnd : bookingEnd;

        // Duration + 1 because if start=end it's 1 day
        const durationDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return {
            left: `${startIndex * dayWidth}px`,
            width: `${durationDays * dayWidth}px`
        };
    };

    const DAY_WIDTH = 40;

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="bg-luxury-gray/50 p-4 rounded-xl border border-gold/20 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gold/20 rounded-lg">
                            <CalendarIcon className="h-6 w-6 text-gold" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-luxury-white">
                                {language === "ar" ? "الجدول الزمني" : "Booking Timeline"}
                            </h1>
                            <p className="text-luxury-white/60 text-sm">
                                {t("admin.manageBookings")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Branch Filter */}
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40" />
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="bg-luxury-black/50 border border-gold/10 rounded-lg pl-9 pr-8 py-2 text-sm text-luxury-white focus:border-gold/50 focus:outline-none appearance-none cursor-pointer min-w-[150px]"
                            >
                                <option value="">{language === "ar" ? "كل الفروع" : "All Branches"}</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {language === "ar" ? b.name_ar : b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40" />
                            <input
                                type="text"
                                placeholder={language === "ar" ? "بحث عن سيارة..." : "Search cars..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-luxury-black/50 border border-gold/10 rounded-lg pl-9 pr-4 py-2 text-sm text-luxury-white focus:border-gold/50 focus:outline-none w-48"
                            />
                        </div>

                        {/* Month Nav */}
                        <div className="flex items-center gap-2 bg-luxury-black/50 p-1 rounded-lg border border-gold/10">
                            <button
                                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                                className="p-2 hover:bg-gold/20 rounded-md text-luxury-white/60 hover:text-gold transition-colors"
                            >
                                <ChevronLeft className={`h-5 w-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                            </button>
                            <span className="min-w-[120px] text-center font-bold text-luxury-white">
                                {format(currentDate, 'MMMM yyyy', { locale: language === 'ar' ? ar : enUS })}
                            </span>
                            <button
                                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                                className="p-2 hover:bg-gold/20 rounded-md text-luxury-white/60 hover:text-gold transition-colors"
                            >
                                <ChevronRight className={`h-5 w-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 text-gold animate-spin" />
                </div>
            ) : (
                <div className="bg-luxury-gray/30 border border-gold/20 rounded-xl overflow-hidden flex flex-col h-[70vh]">
                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <div className="inline-block min-w-full">
                            {/* Header Row (Days) */}
                            <div className="flex sticky top-0 z-20 bg-luxury-gray border-b border-gold/20">
                                <div className="sticky left-0 z-30 w-48 md:w-64 bg-luxury-gray border-r border-gold/20 p-3 font-bold text-luxury-white flex-shrink-0">
                                    {language === "ar" ? "السيارة" : "Vehicle"}
                                </div>
                                <div className="flex">
                                    {daysInMonth.map((day) => (
                                        <div
                                            key={day.toISOString()}
                                            className={`flex-shrink-0 border-r border-gold/10 flex flex-col items-center justify-center py-2
                                                ${isSameDay(day, new Date()) ? 'bg-gold/10' : ''}`}
                                            style={{ width: `${DAY_WIDTH}px` }}
                                        >
                                            <span className="text-xs text-luxury-white/50">{format(day, 'EEE', { locale: language === 'ar' ? ar : enUS })}</span>
                                            <span className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-gold' : 'text-luxury-white'}`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Car Rows */}
                            <div className="divide-y divide-gold/10">
                                {filteredCars.length === 0 && (
                                    <div className="p-8 text-center text-luxury-white/50">
                                        {language === "ar" ? "لا توجد سيارات لعرضها" : "No cars found"}
                                    </div>
                                )}
                                {filteredCars.map((car) => {
                                    const carBookings = bookings.filter(b => b.car_id === car.id);

                                    return (
                                        <div key={car.id} className="flex relative hover:bg-white/5 transition-colors">
                                            <div className="sticky left-0 z-10 w-48 md:w-64 bg-luxury-gray/95 border-r border-gold/20 p-3 flex-shrink-0 flex items-center gap-3 backdrop-blur-sm">
                                                <div>
                                                    <p className="font-bold text-luxury-white text-sm">
                                                        {language === 'ar' && car.name_ar ? car.name_ar : car.name}
                                                    </p>
                                                    <p className="text-xs text-luxury-white/50 uppercase">{car.plate_number}</p>
                                                </div>
                                            </div>

                                            <div className="flex relative h-16">
                                                {daysInMonth.map((day) => (
                                                    <div
                                                        key={day.toISOString()}
                                                        className={`flex-shrink-0 border-r border-gold/5 h-full ${isSameDay(day, new Date()) ? 'bg-gold/5' : ''}`}
                                                        style={{ width: `${DAY_WIDTH}px` }}
                                                    />
                                                ))}

                                                {carBookings.map((booking) => {
                                                    const { left, width } = getBookingPosition(booking, DAY_WIDTH);
                                                    return (
                                                        <div
                                                            key={booking.id}
                                                            className={`absolute top-2 bottom-2 rounded-md shadow-sm overflow-hidden cursor-pointer group hover:z-20 hover:brightness-110 transition-all ${getBookingStyle(booking)}`}
                                                            style={{ left, width }}
                                                            title={`${booking.customer_name} (${format(parseISO(booking.start_date), 'MMM d')} - ${format(parseISO(booking.end_date), 'MMM d')})`}
                                                        >
                                                            <div className="px-2 py-1 h-full flex flex-col justify-center text-xs whitespace-nowrap overflow-hidden">
                                                                <span className="font-bold truncate">{booking.customer_name}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
