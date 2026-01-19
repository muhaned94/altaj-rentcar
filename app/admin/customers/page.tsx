"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Booking } from "@/lib/types";
import { getAllowedBranchIds } from "@/lib/auth-helpers";
import { Users, Search, Loader2, Ban, Phone, History as HistoryIcon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Customer {
    name: string;
    phone: string;
    totalBookings: number;
    totalSpent: number;
    lastBooking: string;
    isBlacklisted?: boolean;
    notes?: string;
}

export default function AdminCustomersPage() {
    const { t, language, dir } = useLanguage();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchCustomers();
    }, []);

    async function fetchCustomers() {
        try {
            setLoading(true);

            // Get allowed branch IDs for RBAC
            const allowedBranchIds = await getAllowedBranchIds();

            // 1. Fetch bookings with branch filter
            let bookingsQuery = supabase
                .from("bookings")
                .select("*")
                .order("created_at", { ascending: false });

            // Apply branch filter for non-super_admin
            if (allowedBranchIds !== null && allowedBranchIds.length > 0) {
                bookingsQuery = bookingsQuery.in("branch_id", allowedBranchIds);
            } else if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                // No branches assigned - show no customers
                setCustomers([]);
                setLoading(false);
                return;
            }
            // If allowedBranchIds is null (super_admin), show all bookings

            const { data: bookingsData, error: bookingsError } = await bookingsQuery;

            if (bookingsError) throw bookingsError;

            // 2. Fetch customer profiles (for blacklist status)
            const { data: profilesData, error: profilesError } = await supabase
                .from("customer_profiles")
                .select("*");

            // Allow initial load even if profiles table is empty/missing
            const profiles = profilesData || [];

            // 3. Aggregate data
            const customerMap = new Map<string, Customer>();

            bookingsData?.forEach((booking: Booking) => {
                const phone = booking.customer_phone;
                // Normalize phone if needed, currently assuming exact match

                const existing = customerMap.get(phone);
                const profile = profiles.find((p: any) => p.phone_number === phone);

                if (existing) {
                    existing.totalBookings += 1;
                    existing.totalSpent += booking.total_amount;
                    // Keep most recent date since we sorted by created_at desc
                    if (new Date(booking.created_at) > new Date(existing.lastBooking)) {
                        existing.lastBooking = booking.created_at;
                    }
                } else {
                    customerMap.set(phone, {
                        name: booking.customer_name,
                        phone: phone,
                        totalBookings: 1,
                        totalSpent: booking.total_amount,
                        lastBooking: booking.created_at,
                        isBlacklisted: profile?.is_blacklisted || false,
                        notes: profile?.notes
                    });
                }
            });

            setCustomers(Array.from(customerMap.values()));

        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white flex items-center gap-2">
                        <Users className="h-6 w-6 text-gold" />
                        {t("admin.crm") || (language === "ar" ? "إدارة العملاء" : "CRM")}
                    </h1>
                    <p className="text-luxury-white/60 mt-1">
                        {customers.length} {language === "ar" ? "عميل مسجل" : "registered customers"}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 h-5 w-5 text-gold`} />
                <input
                    type="text"
                    placeholder={language === "ar" ? "بحث باسم العميل أو الهاتف..." : "Search by name or phone..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"} py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50`}
                />
            </div>

            {/* Customers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((customer) => (
                    <Link
                        key={customer.phone}
                        href={`/admin/customers/${encodeURIComponent(customer.phone)}`}
                        className={`luxury-card hover:border-gold/50 transition-colors group relative overflow-hidden ${customer.isBlacklisted ? 'border-red-500/50 bg-red-900/10' : ''}`}
                    >
                        {customer.isBlacklisted && (
                            <div className="absolute top-2 right-2 text-red-500" title="Blacklisted">
                                <Ban className="h-5 w-5" />
                            </div>
                        )}

                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-luxury-white group-hover:text-gold transition-colors">
                                    {customer.name}
                                </h3>
                                <p className="text-luxury-white/60 text-sm flex items-center gap-1 mt-1" dir="ltr">
                                    <Phone className="h-3 w-3" />
                                    {customer.phone}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-3 border-t border-gold/10">
                            <div>
                                <p className="text-xs text-luxury-white/50 mb-1">
                                    {language === "ar" ? "عدد الحجوزات" : "Total Bookings"}
                                </p>
                                <p className="font-bold text-gold">{customer.totalBookings}</p>
                            </div>
                            <div>
                                <p className="text-xs text-luxury-white/50 mb-1">
                                    {language === "ar" ? "الإجمالي المصروف" : "Total Spent"}
                                </p>
                                <p className="font-bold text-gold">{formatCurrency(customer.totalSpent, language)}</p>
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gold/10 flex justify-between items-center text-xs text-luxury-white/40">
                            <span className="flex items-center gap-1">
                                <HistoryIcon className="h-3 w-3" />
                                {new Date(customer.lastBooking).toLocaleDateString()}
                            </span>
                            <span className="group-hover:translate-x-1 transition-transform text-gold flex items-center gap-1">
                                {language === "ar" ? "التفاصيل" : "Details"}
                                {dir === 'rtl' ? <ArrowRight className="h-3 w-3 rotate-180" /> : <ArrowRight className="h-3 w-3" />}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>

            {filteredCustomers.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-luxury-white/60">
                        {searchQuery ? (language === "ar" ? "لا توجد نتائج" : "No results found") : (language === "ar" ? "لا يوجد عملاء بعد" : "No customers found")}
                    </p>
                </div>
            )}
        </div>
    );
}
