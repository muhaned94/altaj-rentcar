"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { applyBranchFilter, getAllowedBranchIds } from "@/lib/auth-helpers";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Search, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO, isSameDay } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import BookingDetailsModal from "../components/BookingDetailsModal";
import { Booking } from "@/lib/types";

interface InventoryItem {
    id: string; // Inventory ID
    plate_number: string;
    color: string;
    car: {
        id: string;
        name: string;
        name_ar: string;
        model: string;
    }
}

// Global Booking type is imported now.

interface Branch {
    id: string;
    name: string;
    name_ar: string;
}

export default function CalendarPage() {
    const { t, language, dir } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
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

            // 1. Fetch Inventory with Car details and branch filter
            // We need to filter based on the CAR's branch
            let invQuery = supabase
                .from("car_inventory")
                .select("id, plate_number, color, car:cars!inner(id, name, name_ar, model, car_branches!inner(branch_id))")
                .order("plate_number"); // Order by plate or car name? Maybe sort client side

            // Apply branch filter for inventory (via car)
            if (selectedBranchId) {
                // User selected a specific branch
                invQuery = invQuery.eq("car.car_branches.branch_id", selectedBranchId);
            } else if (allowedBranchIds !== null && allowedBranchIds.length > 0) {
                // RBAC filter
                invQuery = invQuery.in("car.car_branches.branch_id", allowedBranchIds);
            } else if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                // No branches
                invQuery = invQuery.in("car.car_branches.branch_id", ['00000000-0000-0000-0000-000000000000']);
            }

            const { data: invData, error: invError } = await invQuery;
            if (invError) throw invError;

            // 2. Fetch Bookings for this month with branch filter
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            let bookingsQuery = supabase
                .from("bookings")
                .select("*, car:cars(name, name_ar, model, year, color, plate_number, daily_rate)")
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

            // Process Inventory Data to flatten structure slightly for easier usage
            const formattedInventory = (invData || []).map((item: any) => ({
                id: item.id,
                plate_number: item.plate_number,
                color: item.color,
                car: item.car
            }));

            // Sort by Car Name then Plate Number
            formattedInventory.sort((a, b) => {
                const nameA = a.car.name || "";
                const nameB = b.car.name || "";
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return a.plate_number.localeCompare(b.plate_number);
            });

            setInventory(formattedInventory);
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


    const filteredInventory = inventory.filter(item =>
        item.car.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.car.name_ar && item.car.name_ar.includes(searchTerm)) ||
        item.plate_number.includes(searchTerm)
    );

    // Group by Car Model
    const groupedInventory = filteredInventory.reduce((acc: any, item) => {
        const carId = item.car.id;
        if (!acc[carId]) {
            acc[carId] = {
                car: item.car,
                items: []
            };
        }
        acc[carId].items.push(item);
        return acc;
    }, {});

    // Add "Unassigned" row for each car group if there are bookings with no inventory_id
    Object.values(groupedInventory).forEach((group: any) => {
        const carId = group.car.id;
        // Find bookings for this car that don't have an inventory_id or inventory_id doesn't match any item
        const existingInventoryIds = new Set(group.items.map((i: any) => i.id));

        const unassignedBookings = bookings.filter(b =>
            b.car_id === carId &&
            (!b.inventory_id || !existingInventoryIds.has(b.inventory_id))
        );

        if (unassignedBookings.length > 0) {
            // Add a fake inventory item for "Unassigned"
            group.items.unshift({
                id: `unassigned-${carId}`,
                plate_number: language === "ar" ? "غير محدد (عام)" : "Unassigned (General)",
                color: "transparent",
                car: group.car,
                isUnassigned: true
            });
        }
    });

    const getBookingStyle = (booking: Booking) => {
        let bgColor = "bg-blue-500";
        let borderColor = "border-blue-600";

        if (booking.status === "pending") {
            bgColor = "bg-yellow-500";
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

        // Duration calculation aligned with pricing (exclusive of return day)
        // If start=Jan 1, end=Jan 2, diff=1 day. Visual width = 1 day column.
        const diffDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
        // Ensure at least 1 day visual min (if start=end?) Although start=end is 0 days, maybe min 1?
        // But logic says Jan 1 - Jan 2 is 1 day.
        // If Jan 1 - Jan 1, that's 0 days? Booking usually has start != end or at least 1 hour?
        // Let's assume min 1 for visual if diff is 0, or just use diff.
        const durationDays = Math.max(diffDays, 1);

        return {
            offset: `${startIndex * dayWidth}px`,
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
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40 rtl:left-auto rtl:right-3" />
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="bg-luxury-black/50 border border-gold/10 rounded-lg pl-9 pr-8 rtl:pr-9 rtl:pl-8 py-2 text-sm text-luxury-white focus:border-gold/50 focus:outline-none appearance-none cursor-pointer min-w-[150px]"
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40 rtl:left-auto rtl:right-3" />
                            <input
                                type="text"
                                placeholder={language === "ar" ? "بحث عن سيارة..." : "Search cars..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-luxury-black/50 border border-gold/10 rounded-lg pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 text-sm text-luxury-white focus:border-gold/50 focus:outline-none w-48"
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
                                <div className={`sticky ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-30 w-48 md:w-64 bg-luxury-gray border-gold/20 p-3 font-bold text-luxury-white flex-shrink-0`}>
                                    {language === "ar" ? "الوحدة (اللوحة)" : "Unit (Plate)"}
                                </div>
                                <div className="flex">
                                    {daysInMonth.map((day) => (
                                        <div
                                            key={day.toISOString()}
                                            className={`flex-shrink-0 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-gold/10 flex flex-col items-center justify-center py-2
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

                            {/* Inventory Rows */}
                            {/* Inventory Rows Grouped by Car */}
                            <div className="divide-y divide-gold/10">
                                {Object.keys(groupedInventory).length === 0 && (
                                    <div className="p-8 text-center text-luxury-white/50">
                                        {language === "ar" ? "لا توجد سيارات لعرضها" : "No vehicles found"}
                                    </div>
                                )}

                                {Object.values(groupedInventory).map((group: any) => (
                                    <div key={group.car.id} className="group-container">
                                        {/* Group Header */}
                                        <div className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 w-full bg-luxury-gray/95 border-b border-gold/10 p-2 px-4 flex items-center justify-between backdrop-blur-sm`}>
                                            <div className="font-bold text-gold text-sm">
                                                {language === 'ar' && group.car.name_ar ? group.car.name_ar : group.car.name}
                                                <span className="ml-2 text-luxury-white/40 text-xs font-normal">
                                                    ({group.items.length} {language === "ar" ? "وحدات" : "units"})
                                                </span>
                                            </div>
                                        </div>

                                        {/* Inventory Items */}
                                        {group.items.map((item: any) => {
                                            const itemBookings = item.isUnassigned
                                                ? bookings.filter(b => b.car_id === group.car.id && (!b.inventory_id || !group.items.some((i: any) => i.id === b.inventory_id && !i.isUnassigned)))
                                                : bookings.filter(b => b.inventory_id === item.id);

                                            // Calculate Lanes for Overlap
                                            const sortedBookings = [...itemBookings].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                                            const lanes: Booking[][] = [];

                                            const positionedBookings = sortedBookings.map(booking => {
                                                // Find the first lane where this booking fits without overlap
                                                let laneIndex = lanes.findIndex(lane => {
                                                    const lastBookingInLane = lane[lane.length - 1];
                                                    // Use strict less than to prevent overlap on the same day
                                                    // If last booking ends on Jan 3, and next starts Jan 3, they overlap visually on Jan 3 cell,
                                                    // so they should NOT share a lane.
                                                    return new Date(lastBookingInLane.end_date) < new Date(booking.start_date);
                                                });

                                                if (laneIndex === -1) {
                                                    laneIndex = lanes.length;
                                                    lanes.push([]);
                                                }

                                                lanes[laneIndex].push(booking);

                                                return {
                                                    ...booking,
                                                    laneIndex
                                                };
                                            });

                                            const EVENT_HEIGHT = 28; // Height of a single booking bar
                                            const EVENT_GAP = 4;     // Vertical gap between bars
                                            const ROW_PADDING = 8;   // Top/Bottom padding for the row container
                                            const MIN_ROW_HEIGHT = 56; // Minimum height (original design)

                                            const maxLaneIndex = lanes.length > 0 ? lanes.length - 1 : 0;
                                            // Calculate total height needed: (Lanes * (Height + Gap)) + Padding
                                            // If no bookings, default to MIN_ROW_HEIGHT
                                            const calculatedHeight = lanes.length > 0
                                                ? (lanes.length * (EVENT_HEIGHT + EVENT_GAP)) + ROW_PADDING
                                                : MIN_ROW_HEIGHT;

                                            const rowHeight = Math.max(calculatedHeight, MIN_ROW_HEIGHT);

                                            return (
                                                <div key={item.id} className="flex relative hover:bg-white/5 transition-colors border-b border-gold/10">
                                                    {/* Row Header (Plate) */}
                                                    <div
                                                        className={`sticky ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-10 w-48 md:w-64 bg-luxury-gray/90 border-gold/20 p-3 pl-8 px-8 flex-shrink-0 flex items-center gap-3 backdrop-blur-sm`}
                                                        style={{ height: `${rowHeight}px` }}
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-mono text-luxury-white">{item.plate_number}</span>
                                                                {item.color && (
                                                                    <div
                                                                        className="w-3 h-3 rounded-full border border-white/20"
                                                                        style={{ backgroundColor: item.color.toLowerCase() }}
                                                                        title={item.color}
                                                                    />
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-luxury-white/40">{item.color}</p>
                                                        </div>
                                                    </div>

                                                    {/* Timeline Cells */}
                                                    <div className="flex relative" style={{ height: `${rowHeight}px` }}>
                                                        {daysInMonth.map((day) => (
                                                            <div
                                                                key={day.toISOString()}
                                                                className={`flex-shrink-0 ${dir === 'rtl' ? 'border-l' : 'border-r'} border-gold/5 h-full ${isSameDay(day, new Date()) ? 'bg-gold/5' : ''}`}
                                                                style={{ width: `${DAY_WIDTH}px` }}
                                                            />
                                                        ))}

                                                        {positionedBookings.map((booking: any) => {
                                                            const { offset, width } = getBookingPosition(booking, DAY_WIDTH);
                                                            const top = (booking.laneIndex * (EVENT_HEIGHT + EVENT_GAP)) + (ROW_PADDING / 2);

                                                            return (
                                                                <div
                                                                    key={booking.id}
                                                                    onClick={() => setSelectedBooking(booking)}
                                                                    className={`absolute rounded-md shadow-sm overflow-hidden cursor-pointer group hover:z-20 hover:brightness-110 transition-all ${getBookingStyle(booking)}`}
                                                                    style={{
                                                                        insetInlineStart: offset,
                                                                        width,
                                                                        top: `${top}px`,
                                                                        height: `${EVENT_HEIGHT}px`
                                                                    }}
                                                                    title={`${booking.customer_name} (${format(parseISO(booking.start_date), 'MMM d')} - ${format(parseISO(booking.end_date), 'MMM d')})`}
                                                                >
                                                                    <div className="px-2 h-full flex items-center text-xs whitespace-nowrap overflow-hidden">
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
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-luxury-gray/50 border-t border-gold/10 p-3 px-6 flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-yellow-600 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
                            <span className="text-xs font-medium text-luxury-white/80">{language === "ar" ? "قيد الانتظار" : "Pending"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-green-600 shadow-[0_0_5px_rgba(34,197,94,0.3)]"></div>
                            <span className="text-xs font-medium text-luxury-white/80">{language === "ar" ? "مؤكد" : "Confirmed"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-500 border border-gray-600"></div>
                            <span className="text-xs font-medium text-luxury-white/80">{language === "ar" ? "مكتمل" : "Completed"}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Booking Details Modal */}
            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onUpdate={() => fetchData(true)}
                />
            )}
        </div>
    );
}
