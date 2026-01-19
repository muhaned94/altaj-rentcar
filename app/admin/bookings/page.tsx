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

export default function AdminBookingsPage() {
    const { t, language, dir } = useLanguage();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showConfirmed, setShowConfirmed] = useState(true);

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

            // Log the action with rich details
            await logAction(
                newStatus === 'confirmed' ? 'APPROVE_BOOKING' :
                    newStatus === 'cancelled' ? 'REJECT_BOOKING' :
                        newStatus === 'completed' ? 'COMPLETE_BOOKING' : 'UPDATE_STATUS',
                bookingId,
                booking
                    ? `Status: ${newStatus} | Customer: ${booking.customer_name} | Car: ${carName} | Dates: ${new Date(booking.start_date).toLocaleDateString()} - ${new Date(booking.end_date).toLocaleDateString()}`
                    : `Changed status to ${newStatus}`
            );

            // 2. Update Car Status Logic
            if (booking && booking.car_id) {
                let newCarStatus = "";

                if (newStatus === "confirmed") {
                    newCarStatus = "rented";
                } else if (newStatus === "completed" || newStatus === "cancelled") {
                    newCarStatus = "available";
                }

                if (newCarStatus) {
                    const { error: carError } = await supabase
                        .from("cars")
                        .update({ status: newCarStatus })
                        .eq("id", booking.car_id);

                    if (carError) {
                        console.error("Error updating car status:", carError);
                        // Optional: Show a warning but don't fail the whole operation
                    }
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

            {/* Quick Actions for Pending */}
            {showQuickActions && booking.status === "pending" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gold/20" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => updateStatus(booking.id, "confirmed")}
                        disabled={updatingId === booking.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        {language === "ar" ? "قبول" : "Accept"}
                    </button>
                    <button
                        onClick={() => updateStatus(booking.id, "cancelled")}
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
            {
                selectedBooking && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
                        <div
                            className="bg-luxury-gray border border-gold/30 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                            dir={dir}
                        >
                            {/* Modal Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-luxury-white">{t("admin.bookingDetails")}</h2>
                                    <p className="text-luxury-white/60 text-sm mt-1">
                                        {new Date(selectedBooking.created_at).toLocaleString(language === "ar" ? 'ar-IQ' : 'en-US')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedBooking(null)}
                                    className="p-2 text-luxury-white/60 hover:text-luxury-white hover:bg-gold/10 rounded-lg"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Status Badge */}
                            <div className="mb-6">
                                <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusBadge(selectedBooking.status)}`}>
                                    {getStatusLabel(selectedBooking.status)}
                                </span>
                            </div>

                            {/* Customer Info */}
                            <div className="luxury-card bg-luxury-black/50 mb-4">
                                <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    {t("admin.customerInfo")}
                                </h3>
                                <div className="space-y-2">
                                    <p className="text-luxury-white font-medium text-lg">{selectedBooking.customer_name}</p>
                                    <p className="text-luxury-white/80 flex items-center gap-2" dir="ltr">
                                        <Phone className="h-4 w-4 text-gold" />
                                        {selectedBooking.customer_phone}
                                    </p>
                                    {selectedBooking.customer_email && (
                                        <p className="text-luxury-white/80 flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-gold" />
                                            {selectedBooking.customer_email}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Car Info */}
                            <div className="luxury-card bg-luxury-black/50 mb-4">
                                <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                    <Car className="h-5 w-5" />
                                    {t("admin.carInfo")}
                                </h3>
                                <p className="text-luxury-white font-medium text-lg">{getCarName(selectedBooking.car)}</p>
                                {selectedBooking.car?.model && (
                                    <p className="text-luxury-white/60 text-sm">{selectedBooking.car.model}</p>
                                )}
                                {selectedBooking.car?.plate_number && (
                                    <p className="text-gold/80 text-sm mt-1 bg-black/20 px-2 py-1 rounded inline-block">
                                        {language === "ar" ? "رقم اللوحة:" : "Plate:"} {selectedBooking.car.plate_number}
                                    </p>
                                )}
                            </div>

                            {/* Booking Details */}
                            <div className="luxury-card bg-luxury-black/50 mb-4">
                                <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    {t("admin.bookingDetailsTitle")}
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-luxury-white/60">{t("admin.pickupDate")}:</span>
                                        <span className="text-luxury-white font-medium">{formatDate(selectedBooking.start_date)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-luxury-white/60">{t("admin.returnDate")}:</span>
                                        <span className="text-luxury-white font-medium">{formatDate(selectedBooking.end_date)}</span>
                                    </div>
                                    {selectedBooking.pickup_time && (
                                        <div className="flex justify-between">
                                            <span className="text-luxury-white/60">{t("admin.pickupTime")}:</span>
                                            <span className="text-luxury-white font-medium">{selectedBooking.pickup_time}</span>
                                        </div>
                                    )}
                                    {selectedBooking.branch && (
                                        <div className="flex justify-between">
                                            <span className="text-luxury-white/60">{t("admin.branchLocation")}:</span>
                                            <span className="text-luxury-white font-medium">{selectedBooking.branch}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedBooking.notes && (
                                <div className="luxury-card bg-luxury-black/50 mb-4">
                                    <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        {t("admin.notes")}
                                    </h3>
                                    <p className="text-luxury-white/80">{selectedBooking.notes}</p>
                                </div>
                            )}

                            {/* Amount */}
                            <div className="luxury-card bg-gold/10 border-gold/30 mb-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-luxury-white font-medium">{t("admin.totalAmount")}</span>
                                    <span className="text-gold font-bold text-2xl">{formatCurrency(selectedBooking.total_amount, language)}</span>
                                </div>
                            </div>

                            {/* WhatsApp Button in Modal */}
                            {(selectedBooking.status === "confirmed" || selectedBooking.status === "pending") && (
                                <button
                                    onClick={() => openWhatsApp(selectedBooking)}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold mb-4"
                                >
                                    <Phone className="h-5 w-5" />
                                    {selectedBooking.status === "pending" ? "إرسال واتساب (طلب مستمسكات)" : "إرسال واتساب (موافقة + مستمسكات)"}
                                </button>
                            )}

                            {/* Quick Actions */}
                            {selectedBooking.status === "pending" && (
                                <div className="flex gap-3 mb-4">
                                    <button
                                        onClick={() => updateStatus(selectedBooking.id, "confirmed")}
                                        disabled={updatingId === selectedBooking.id}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 font-semibold"
                                    >
                                        <Check className="h-5 w-5" />
                                        {language === "ar" ? "قبول الحجز" : "Accept Booking"}
                                    </button>
                                    <button
                                        onClick={() => updateStatus(selectedBooking.id, "cancelled")}
                                        disabled={updatingId === selectedBooking.id}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 font-semibold"
                                    >
                                        <XCircle className="h-5 w-5" />
                                        {language === "ar" ? "رفض" : "Reject"}
                                    </button>
                                </div>
                            )}

                            {selectedBooking.status === "confirmed" && (
                                <button
                                    onClick={() => updateStatus(selectedBooking.id, "completed")}
                                    disabled={updatingId === selectedBooking.id}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 font-semibold mb-4"
                                >
                                    <Check className="h-5 w-5" />
                                    {language === "ar" ? "إكمال الحجز" : "Mark as Completed"}
                                </button>
                            )}

                            {/* National ID & Contract - For confirmed/completed bookings */}
                            {(selectedBooking.status === "confirmed" || selectedBooking.status === "completed") && (
                                <div className="luxury-card bg-amber-500/10 border-amber-500/30 mb-4">
                                    <h3 className="text-amber-400 font-semibold mb-3">
                                        {language === "ar" ? "عقد الإيجار" : "Rental Contract"}
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-luxury-white/80 text-sm mb-2">
                                                {language === "ar" ? "رقم البطاقة الوطنية" : "National ID"}
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={selectedBooking.national_id || ""}
                                                    onChange={(e) => setSelectedBooking({ ...selectedBooking, national_id: e.target.value })}
                                                    className="flex-1 px-4 py-2 bg-luxury-black border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                                    placeholder={language === "ar" ? "أدخل رقم البطاقة" : "Enter ID number"}
                                                    dir="ltr"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await supabase
                                                                .from("bookings")
                                                                .update({ national_id: selectedBooking.national_id })
                                                                .eq("id", selectedBooking.id);
                                                            setBookings(bookings.map(b =>
                                                                b.id === selectedBooking.id ? { ...b, national_id: selectedBooking.national_id } : b
                                                            ));
                                                            alert(language === "ar" ? "تم الحفظ" : "Saved!");
                                                        } catch (error) {
                                                            alert(t("common.error"));
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-gold text-luxury-black rounded-lg hover:bg-gold-light font-medium"
                                                >
                                                    {language === "ar" ? "حفظ" : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                        <a
                                            href={`/admin/bookings/contract/${selectedBooking.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold"
                                        >
                                            <FileText className="h-5 w-5" />
                                            {language === "ar" ? "طباعة العقد" : "Print Contract"}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Status Dropdown for other cases */}
                            {(selectedBooking.status === "completed" || selectedBooking.status === "cancelled") && (
                                <div>
                                    <label className="block text-luxury-white/80 text-sm mb-2">{t("admin.updateStatus")}:</label>
                                    <select
                                        value={selectedBooking.status}
                                        onChange={(e) => updateStatus(selectedBooking.id, e.target.value)}
                                        disabled={updatingId === selectedBooking.id}
                                        className="w-full px-4 py-3 bg-luxury-black border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 disabled:opacity-50"
                                    >
                                        <option value="pending">{t("admin.statusPending")}</option>
                                        <option value="confirmed">{t("admin.statusConfirmed")}</option>
                                        <option value="completed">{t("admin.statusCompleted")}</option>
                                        <option value="cancelled">{t("admin.statusCancelled")}</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
