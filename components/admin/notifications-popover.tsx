"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Booking } from "@/lib/types";
import { Bell, AlertTriangle, Clock, Calendar, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { applyBranchFilter } from "@/lib/auth-helpers";

interface Notification {
    id: string;
    type: "return_due" | "new_booking" | "blacklist_alert";
    title: string;
    message: string;
    link: string;
    date: string;
    isRead: boolean;
}

export default function NotificationsPopover() {
    const { t, language, dir } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();

        // 1. Real-time subscription for new bookings
        const channel = supabase
            .channel('notifications-bookings')
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
                        fetchNotifications();
                    }
                }
            )
            .subscribe();

        // 2. Poll every 10 seconds (Fallback)
        const intervalId = setInterval(() => {
            fetchNotifications();
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, []);

    async function fetchNotifications() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const newNotifs: Notification[] = [];

            // 1. Fetch Returns Due Today (Confirmed and end_date = today)
            // Apply Branch Filter: Managers only see returns for their branch
            let returnsQuery = supabase
                .from("bookings")
                .select("*, car:cars(name)")
                .eq("status", "confirmed")
                .eq("end_date", today);

            returnsQuery = await applyBranchFilter(returnsQuery, 'branch_id');
            const { data: returnsDue } = await returnsQuery;

            returnsDue?.forEach((booking: any) => {
                newNotifs.push({
                    id: `return-${booking.id}`,
                    type: "return_due",
                    title: language === "ar" ? "موعد إرجاع سيارة" : "Car Return Due",
                    message: language === "ar"
                        ? `يجب إرجاع سيارة ${booking.car?.name} اليوم`
                        : `Vehicle ${booking.car?.name} is due for return today`,
                    link: `/admin/bookings/contract/${booking.id}`,
                    date: booking.end_date,
                    isRead: false
                });
            });

            // 2. Fetch Pending Bookings (Last 5)
            // Apply Branch Filter: Managers only see pending bookings for their branch
            let pendingQuery = supabase
                .from("bookings")
                .select("*, car:cars(name)")
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(5);

            pendingQuery = await applyBranchFilter(pendingQuery, 'branch_id');
            const { data: pending } = await pendingQuery;

            // 3. Check for Blacklisted Customers in Pending
            if (pending && pending.length > 0) {
                const phones = pending.map((b: any) => b.customer_phone);
                const { data: blacklisted } = await supabase
                    .from("customer_profiles")
                    .select("phone_number")
                    .in("phone_number", phones)
                    .eq("is_blacklisted", true);

                const blacklistedPhones = new Set(blacklisted?.map((c: any) => c.phone_number));

                pending.forEach((booking: any) => {
                    const isBlacklisted = blacklistedPhones.has(booking.customer_phone);

                    if (isBlacklisted) {
                        newNotifs.push({
                            id: `risk-${booking.id}`,
                            type: "blacklist_alert",
                            title: language === "ar" ? "تنبيه: عميل محظور" : "Warning: Blacklisted Customer",
                            message: language === "ar"
                                ? `حاولة حجز من عميل في القائمة السوداء: ${booking.customer_name}`
                                : `Booking attempt from blacklisted customer: ${booking.customer_name}`,
                            link: `/admin/customers/${encodeURIComponent(booking.customer_phone)}`,
                            date: booking.created_at,
                            isRead: false
                        });
                    }

                    newNotifs.push({
                        id: `new-${booking.id}`,
                        type: "new_booking",
                        title: language === "ar" ? "حجز جديد" : "New Booking",
                        message: language === "ar"
                            ? `حجز جديد للسيارة ${booking.car?.name} من ${booking.customer_name}`
                            : `New booking for ${booking.car?.name} from ${booking.customer_name}`,
                        link: `/admin/bookings`, // Detailed contract link might be better if we had specific booking view
                        date: booking.created_at,
                        isRead: false
                    });
                });
            }

            setNotifications(newNotifs);
            setUnreadCount(newNotifs.length);

        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-luxury-white/60 hover:text-gold transition-colors"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full px-1 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={`absolute top-full ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-80 md:w-96 bg-luxury-gray border border-gold/20 rounded-xl shadow-2xl z-50 overflow-hidden`}>
                        <div className="flex items-center justify-between p-4 border-b border-gold/10 bg-luxury-black/50">
                            <h3 className="font-bold text-luxury-white">
                                {language === "ar" ? "التنبيهات" : "Notifications"}
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-luxury-white/40 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-luxury-white/40">
                                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p>{language === "ar" ? "لا توجد تنبيهات" : "No new notifications"}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gold/10">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`p-4 hover:bg-gold/5 transition-colors relative ${notification.type === 'blacklist_alert' ? 'bg-red-900/10' : ''
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1 flex-shrink-0 
                                                    ${notification.type === 'return_due' ? 'text-yellow-500' :
                                                        notification.type === 'blacklist_alert' ? 'text-red-500' : 'text-blue-500'}`}
                                                >
                                                    {notification.type === 'return_due' && <Clock className="h-5 w-5" />}
                                                    {notification.type === 'blacklist_alert' && <AlertTriangle className="h-5 w-5" />}
                                                    {notification.type === 'new_booking' && <Calendar className="h-5 w-5" />}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className={`text-sm font-bold mb-1 ${notification.type === 'blacklist_alert' ? 'text-red-400' : 'text-luxury-white'
                                                        }`}>
                                                        {notification.title}
                                                    </h4>
                                                    <p className="text-xs text-luxury-white/70 mb-2 leading-relaxed">
                                                        {notification.message}
                                                    </p>
                                                    <Link
                                                        href={notification.link}
                                                        onClick={() => setIsOpen(false)}
                                                        className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                                                    >
                                                        {language === "ar" ? "عرض التفاصيل" : "View Details"}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
