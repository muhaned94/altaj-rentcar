"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Booking } from "@/lib/types";
import { logAction } from "@/lib/audit";
import { formatCurrency, formatDate, getStatusBadge } from "@/lib/utils";
import { applyBranchFilter, getAllowedBranchIds } from "@/lib/auth-helpers";
import {
    Search,
    Loader2,
    Calendar,
    Filter,
    Phone,
    Mail,
    MapPin,
    Clock,
    Car,
    User,
    FileText,
    X,
    Check,
    XCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Plus
} from "lucide-react";
import BookingDetailsModal from "../components/BookingDetailsModal";

export default function AdminBookingsPage() {
    const { t, language, dir } = useLanguage();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showConfirmed, setShowConfirmed] = useState(true);

    // New State for Fleet Logic



    async function fetchBookings(silent = false) {
        try {
            if (!silent) setLoading(true);
            let query = supabase
                .from("bookings")
                .select("*, car:cars(name, name_ar, model, daily_rate, plate_number, branch_id)")
                .order("created_at", { ascending: false });

            // Apply branch RBAC filter
            query = await applyBranchFilter(query, 'branch_id');

            const { data, error } = await query;

            if (error) throw error;

            // Check for new bookings to play sound (only if we already have data)
            if (silent && bookings.length > 0 && data && data.length > bookings.length) {
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch(() => { });
            }

            setBookings(data || []);
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    // Real-time Subscription + Smart Polling (Fallback)
    useEffect(() => {
        // Initial Fetch
        fetchBookings();

        // 1. Setup Realtime Subscription
        const channel = supabase
            .channel('admin-bookings-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings'
                },
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
                        fetchBookings(true);
                    }
                }
            )
            .subscribe();

        // 2. Setup Polling (Auto-refresh every 10 seconds)
        // This guarantees updates even if Realtime is not enabled in dashboard
        const intervalId = setInterval(() => {
            fetchBookings(true);
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, []);



    // No longer need fetchAlternativeCars or the useEffect here as it's handled in the modal or we pass it down
    // But wait, the modal fetches its own inventory now? Yes, I implemented fetchInventory inside the modal.
    // So I can remove fetchAlternativeCars and the useEffect.

    async function updateStatus(bookingId: string, newStatus: string) {
        try {
            setUpdatingId(bookingId);

            // 1. Update Booking Status
            const { error: bookingError } = await supabase
                .from("bookings")
                .update({ status: newStatus })
                .eq("id", bookingId);

            if (bookingError) throw bookingError;

            // Get booking details for the log
            const booking = bookings.find(b => b.id === bookingId);
            const carName = booking ? (language === "ar" && booking.car?.name_ar ? booking.car.name_ar : booking.car?.name) : "Unknown Car";

            // Determine Inventory ID and fetch Plate Number for Log
            const invId = booking?.inventory_id;
            let plateInfo = "";

            if (invId) {
                const { data: remoteInv } = await supabase.from("car_inventory").select("plate_number, color").eq("id", invId).single();
                if (remoteInv) {
                    plateInfo = ` | Plate: ${remoteInv.plate_number} | Color: ${remoteInv.color}`;
                }
            }

            // Determine Log Action
            let logType = 'UPDATE_STATUS';
            const oldStatus = booking?.status;

            if (newStatus === 'confirmed' && oldStatus === 'pending') {
                logType = 'APPROVE_BOOKING';
            } else if (newStatus === 'cancelled') {
                logType = 'REJECT_BOOKING';
            } else if (newStatus === 'completed') {
                logType = 'COMPLETE_BOOKING';
            } else if (oldStatus === 'confirmed' && newStatus === 'confirmed') {
                logType = 'EDIT_BOOKING'; // Editing confirmed booking
            } else if (oldStatus === 'completed' && newStatus === 'completed') {
                logType = 'EDIT_BOOKING';
            } else if (oldStatus === 'confirmed' && newStatus === 'pending') {
                logType = 'EDIT_BOOKING'; // Reverting to pending
            }

            // Log the action with rich details
            await logAction(
                logType,
                bookingId,
                booking
                    ? `Status: ${newStatus} | Customer: ${booking.customer_name} | Car: ${carName}${plateInfo} | Dates: ${new Date(booking.start_date).toLocaleDateString()} - ${new Date(booking.end_date).toLocaleDateString()}`
                    : `Changed status to ${newStatus}`
            );

            // 1.5 Update Car Assignment & Notes (if defined)
            // Note: This function handles simple status updates (like quick actions).
            // Complex edits are now done inside BookingDetailsModal.
            const updates: any = { status: newStatus };

            // Inventory Swap Logic - Only relevant if we are doing quick confirm from dashboard card without modal
            // But Wait: The quick actions call updateStatus directly. 
            // If I remove the state variables (targetInventoryId), I need to handle quick confirm logic differently or rely on auto-assign.

            // Quick fix: For quick 'Confirm', we might just set status. But wait, we need to assign a car.
            // The old quick action 'Accept' (updateStatus(id, 'confirmed')) would try to use targetInventoryId.
            // BUT, now that state is gone. Quick actions might be risky if they don't assign a car.
            // Actually, the improved modal should be the primary way to Confirm & Assign.
            // Let's modify Quick Actions to OPEN the modal instead of direct confirm?
            // Or keep simple actions for Cancel/Complete. 

            // For now, I will simplify this function to just update status (and free/rent current car if applicable).
            // Assigning specific inventory is best done via the Modal.

            const { error: updateError } = await supabase
                .from("bookings")
                .update(updates)
                .eq("id", bookingId);

            if (updateError) throw updateError;

            // 2. Update Car Status Logic
            if (booking && booking.car_id) {
                let newCarStatus = "";
                if (newStatus === "confirmed") {
                    newCarStatus = "rented";
                } else if (newStatus === "completed" || newStatus === "cancelled" || newStatus === "pending") {
                    newCarStatus = "available";
                }

                if (newCarStatus && booking.inventory_id) {
                    const { error: carError } = await supabase
                        .from("car_inventory")
                        .update({ status: newCarStatus })
                        .eq("id", booking.inventory_id);

                    if (carError) console.error("Error updating inventory status:", carError);
                }
            }

            // 3. Update Local State
            setBookings(bookings.map((b) =>
                b.id === bookingId ? { ...b, status: newStatus as Booking["status"] } : b
            ));

            if (selectedBooking?.id === bookingId) {
                setSelectedBooking({ ...selectedBooking, status: newStatus as Booking["status"] });
            }

        } catch (error) {
            console.error("Error updating booking:", error);
            alert(t("common.error"));
        } finally {
            setUpdatingId(null);
        }
    }

    const getCarName = (car: any) => {
        if (!car) return t("common.car");
        return language === "ar" && car.name_ar ? car.name_ar : car.name;
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: t("admin.statusPending"),
            confirmed: t("admin.statusConfirmed"),
            completed: t("admin.statusCompleted"),
            cancelled: t("admin.statusCancelled"),
        };
        return labels[status] || status;
    };

    // Filter and categorize bookings
    const filterBySearch = (booking: Booking) => {
        if (!searchQuery) return true;
        return (
            booking.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            booking.customer_phone.includes(searchQuery) ||
            booking.car?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            booking.branch?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const pendingBookings = bookings.filter(b => b.status === "pending" && filterBySearch(b));
    const confirmedBookings = bookings.filter(b => b.status === "confirmed" && filterBySearch(b));
    const completedBookings = bookings.filter(b => b.status === "completed" && filterBySearch(b));
    const cancelledBookings = bookings.filter(b => b.status === "cancelled" && filterBySearch(b));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    const openWhatsApp = (booking: Booking, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        const carName = getCarName(booking.car);
        const bookingRef = booking.booking_number ? `#${String(booking.booking_number).padStart(4, '0')}` : '';

        const isPending = booking.status === 'pending';
        let text = `مرحباً ${booking.customer_name}،
معكم شركة التاج لتأجير السيارات
${isPending ? 'استلمنا طلب حجزك' : `تم تأكيد حجزك ${bookingRef ? `(رقم العقد ${bookingRef})` : ''}`} لسيارة ${carName}. 🚗`;

        if (isPending) {
            text += `

يرجى إرسال صور المستمسكات التالية لإكمال إجراءات الحجز والموافقة عليه:
1. البطاقة الوطنية (وجه وظهر)
2. إجازة السوق`;
        }

        text += `

شكراً لاختيارك شركة التاج!`;

        const encodedText = encodeURIComponent(text);
        const url = `https://wa.me/${booking.customer_phone.replace(/\D/g, '')}?text=${encodedText}`;
        window.open(url, '_blank');
    };

    const BookingCard = ({ booking, showQuickActions = false }: { booking: Booking; showQuickActions?: boolean }) => (
        <div
            className="luxury-card cursor-pointer hover:border-gold/50 transition-colors"
            onClick={() => setSelectedBooking(booking)}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className="text-luxury-white font-bold">{booking.customer_name}</h3>
                    <p className="text-luxury-white/60 text-sm flex items-center gap-1" dir="ltr">
                        <Phone className="h-3 w-3" />
                        {booking.customer_phone}
                    </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                </span>
            </div>

            {/* Car & Details */}
            <div className="space-y-1 text-sm mb-3">
                <div className="flex items-center gap-2 text-luxury-white">
                    <Car className="h-4 w-4 text-gold" />
                    <span>{getCarName(booking.car)}</span>
                </div>
                <div className="flex items-center gap-2 text-luxury-white/70">
                    <Calendar className="h-4 w-4 text-gold" />
                    <span>{new Date(booking.start_date).toLocaleDateString(language === "ar" ? 'ar-IQ' : 'en-US')} → {new Date(booking.end_date).toLocaleDateString(language === "ar" ? 'ar-IQ' : 'en-US')}</span>
                </div>
                {booking.branch && (
                    <div className="flex items-center gap-2 text-luxury-white/70">
                        <MapPin className="h-4 w-4 text-gold" />
                        <span>{booking.branch}</span>
                    </div>
                )}
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between pt-3 border-t border-gold/20">
                <span className="text-gold font-bold">{formatCurrency(booking.total_amount, language)}</span>
                <span className="text-luxury-white/50 text-xs">
                    {new Date(booking.created_at).toLocaleDateString(language === "ar" ? 'ar-IQ' : 'en-US')}
                </span>
            </div>

            {/* WhatsApp Button for Confirmed & Pending */}
            {(booking.status === "confirmed" || booking.status === "pending") && (
                <div className="mt-3 pt-3 border-t border-gold/20">
                    <button
                        onClick={(e) => openWhatsApp(booking, e)}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                        <Phone className="h-4 w-4" />
                        واتساب (طلب مستمسكات)
                    </button>
                </div>
            )}

            {/* Quick Actions for Pending - Modified to Open Modal for 'Confirm' to ensure inventory selection */}
            {showQuickActions && booking.status === "pending" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gold/20" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                        <Check className="h-4 w-4" />
                        {language === "ar" ? "قبول" : "Accept"}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(booking.id, "cancelled");
                        }}
                        disabled={updatingId === booking.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                        <XCircle className="h-4 w-4" />
                        {language === "ar" ? "رفض" : "Reject"}
                    </button>
                </div>
            )}

            {/* Quick Action for Confirmed */}
            {showQuickActions && booking.status === "confirmed" && (
                <div className="mt-2 pt-2 border-t border-gold/20" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => updateStatus(booking.id, "completed")}
                        disabled={updatingId === booking.id}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        {language === "ar" ? "إكمال الحجز" : "Mark Complete"}
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8" dir={dir}>
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-luxury-white">
                        {language === "ar" ? "إدارة الحجوزات" : "Bookings Management"}
                    </h1>
                    <p className="text-luxury-white/60 mt-1">
                        {language === "ar" ? "تابع وإدر جميع حجوزاتك من مكان واحد" : "Track and manage all your bookings from one place"}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/bookings/new" className="px-4 py-3 bg-gold text-luxury-black font-bold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        {language === "ar" ? "حجز مباشر" : "Direct Booking"}
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-luxury-gray border border-gold/10 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <FileText className="h-16 w-16 text-luxury-white" />
                    </div>
                    <p className="text-luxury-white/60 text-sm mb-1">{language === "ar" ? "الكل" : "Total"}</p>
                    <p className="text-2xl font-bold text-luxury-white">{bookings.length}</p>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Clock className="h-16 w-16 text-yellow-500" />
                    </div>
                    <p className="text-yellow-400/80 text-sm mb-1">{language === "ar" ? "جديد" : "New"}</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingBookings.length}</p>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Check className="h-16 w-16 text-blue-500" />
                    </div>
                    <p className="text-blue-400/80 text-sm mb-1">{language === "ar" ? "مؤكد" : "Confirmed"}</p>
                    <p className="text-2xl font-bold text-blue-400">{confirmedBookings.length}</p>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Calendar className="h-16 w-16 text-green-500" />
                    </div>
                    <p className="text-green-400/80 text-sm mb-1">{language === "ar" ? "مكتمل" : "Completed"}</p>
                    <p className="text-2xl font-bold text-green-400">{completedBookings.length}</p>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <XCircle className="h-16 w-16 text-red-500" />
                    </div>
                    <p className="text-red-400/80 text-sm mb-1">{language === "ar" ? "ملغي" : "Cancelled"}</p>
                    <p className="text-2xl font-bold text-red-400">{cancelledBookings.length}</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 h-5 w-5 text-gold`} />
                <input
                    type="text"
                    placeholder={t("admin.searchBookings")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"} py-4 bg-luxury-gray border border-gold/20 rounded-xl text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 shadow-lg shadow-black/20`}
                />
            </div>

            {/* PENDING BOOKINGS - NEW */}
            {
                pendingBookings.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-yellow-500/20 rounded-lg">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-luxury-white">
                                {language === "ar" ? "طلبات جديدة" : "New Requests"}
                                <span className="text-yellow-400 mx-2">({pendingBookings.length})</span>
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingBookings.map((booking) => (
                                <BookingCard key={booking.id} booking={booking} showQuickActions={true} />
                            ))}
                        </div>
                    </div>
                )
            }

            {/* CONFIRMED BOOKINGS */}
            <div>
                <button
                    onClick={() => setShowConfirmed(!showConfirmed)}
                    className="flex items-center gap-3 mb-4 w-full text-left"
                >
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Check className="h-5 w-5 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-luxury-white flex-1">
                        {language === "ar" ? "الحجوزات المؤكدة" : "Confirmed Bookings"}
                        <span className="text-blue-400 mx-2">({confirmedBookings.length})</span>
                    </h2>
                    {showConfirmed ? <ChevronUp className="h-5 w-5 text-gold" /> : <ChevronDown className="h-5 w-5 text-gold" />}
                </button>

                {showConfirmed && confirmedBookings.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {confirmedBookings.map((booking) => (
                            <BookingCard key={booking.id} booking={booking} showQuickActions={true} />
                        ))}
                    </div>
                )}

                {showConfirmed && confirmedBookings.length === 0 && (
                    <p className="text-luxury-white/60 text-center py-4">
                        {language === "ar" ? "لا توجد حجوزات مؤكدة" : "No confirmed bookings"}
                    </p>
                )}
            </div>

            {/* COMPLETED & CANCELLED BOOKINGS */}
            <div>
                <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-3 mb-4 w-full text-left"
                >
                    <div className="p-2 bg-green-500/20 rounded-lg">
                        <Calendar className="h-5 w-5 text-green-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-luxury-white flex-1">
                        {language === "ar" ? "الحجوزات المكتملة والملغية" : "Completed & Cancelled"}
                        <span className="text-green-400 mx-2">({completedBookings.length + cancelledBookings.length})</span>
                    </h2>
                    {showCompleted ? <ChevronUp className="h-5 w-5 text-gold" /> : <ChevronDown className="h-5 w-5 text-gold" />}
                </button>

                {showCompleted && (completedBookings.length > 0 || cancelledBookings.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...completedBookings, ...cancelledBookings].map((booking) => (
                            <BookingCard key={booking.id} booking={booking} showQuickActions={false} />
                        ))}
                    </div>
                )}

                {showCompleted && completedBookings.length === 0 && cancelledBookings.length === 0 && (
                    <p className="text-luxury-white/60 text-center py-4">
                        {language === "ar" ? "لا توجد حجوزات مكتملة" : "No completed bookings"}
                    </p>
                )}
            </div>

            {/* No Results */}
            {
                pendingBookings.length === 0 && confirmedBookings.length === 0 && completedBookings.length === 0 && cancelledBookings.length === 0 && (
                    <div className="luxury-card text-center py-12">
                        <Calendar className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                        <p className="text-luxury-white/60">
                            {searchQuery ? t("admin.noBookingsMatch") : t("admin.noBookingsYet")}
                        </p>
                    </div>
                )
            }


            {/* Booking Details Modal */}
            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onUpdate={() => fetchBookings(true)}
                />
            )}
        </div>
    );
}

