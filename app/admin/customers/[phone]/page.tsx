"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Booking } from "@/lib/types";
import { formatCurrency, formatDate, getStatusBadge } from "@/lib/utils";
import { Loader2, ArrowLeft, Phone, Ban, CheckCircle, Save, Car, Calendar, DollarSign, History as HistoryIcon } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailsPage() {
    const params = useParams();
    // Assuming phone is passed as URL param, need to decode it
    const phoneNumber = decodeURIComponent(params.phone as string);
    const { t, language, dir } = useLanguage();
    const router = useRouter();

    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState("");
    const [isBlacklisted, setIsBlacklisted] = useState(false);
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCustomerData();
    }, [phoneNumber]);

    async function fetchCustomerData() {
        try {
            setLoading(true);

            // 1. Fetch bookings for this phone
            const { data: bookingsData, error: bookingsError } = await supabase
                .from("bookings")
                .select("*, car:cars(*)")
                .eq("customer_phone", phoneNumber)
                .order("created_at", { ascending: false });

            if (bookingsError) throw bookingsError;

            setBookings(bookingsData || []);
            if (bookingsData && bookingsData.length > 0) {
                setCustomerName(bookingsData[0].customer_name);
            }

            // 2. Fetch profile status
            const { data: profileData, error: profileError } = await supabase
                .from("customer_profiles")
                .select("*")
                .eq("phone_number", phoneNumber)
                .single();

            if (profileData) {
                setIsBlacklisted(profileData.is_blacklisted);
                setNotes(profileData.notes || "");
            }

        } catch (error) {
            console.error("Error fetching customer details:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile() {
        try {
            setSaving(true);

            // Use upsert for better reliability (Insert if not exists, Update if exists)
            const { error: upsertError } = await supabase
                .from("customer_profiles")
                .upsert({
                    phone_number: phoneNumber,
                    full_name: customerName,
                    is_blacklisted: isBlacklisted,
                    notes: notes,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'phone_number' });

            if (upsertError) throw upsertError;

            alert(language === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");
            fetchCustomerData(); // Refresh to ensure everything is synced

        } catch (error: any) {
            console.error("Error saving profile:", error);
            alert(language === "ar" ? `خطأ: ${error.message}` : `Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    const totalSpent = bookings.reduce((sum, b) => sum + b.total_amount, 0);

    return (
        <div className="space-y-8" dir={dir}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/customers" className="p-2 hover:bg-gold/10 rounded-full text-luxury-white/60 hover:text-gold transition-colors">
                    <ArrowLeft className={`h-6 w-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white">{customerName}</h1>
                    <p className="text-luxury-white/60 flex items-center gap-2 mt-1" dir="ltr">
                        <Phone className="h-4 w-4 text-gold" />
                        {phoneNumber}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="luxury-card p-6 bg-blue-900/10 border-blue-500/20">
                    <Car className="h-8 w-8 text-blue-400 mb-2" />
                    <p className="text-luxury-white/60 text-sm">{language === "ar" ? "إجمالي الحجوزات" : "Total Bookings"}</p>
                    <p className="text-2xl font-bold text-luxury-white">{bookings.length}</p>
                </div>
                <div className="luxury-card p-6 bg-green-900/10 border-green-500/20">
                    <DollarSign className="h-8 w-8 text-green-400 mb-2" />
                    <p className="text-luxury-white/60 text-sm">{language === "ar" ? "إجمالي المنصرف" : "Total Spent"}</p>
                    <p className="text-2xl font-bold text-luxury-white">{formatCurrency(totalSpent, language)}</p>
                </div>
                <div className={`luxury-card p-6 border transition-colors ${isBlacklisted ? 'bg-red-900/20 border-red-500' : 'bg-luxury-black/50 border-gold/20'}`}>
                    {isBlacklisted ? <Ban className="h-8 w-8 text-red-500 mb-2" /> : <CheckCircle className="h-8 w-8 text-green-500 mb-2" />}
                    <p className="text-luxury-white/60 text-sm">{language === "ar" ? "حالة العميل" : "Customer Status"}</p>
                    <p className={`text-2xl font-bold ${isBlacklisted ? 'text-red-500' : 'text-green-500'}`}>
                        {isBlacklisted
                            ? (language === "ar" ? "القائمة السوداء" : "Blacklisted")
                            : (language === "ar" ? "عميل جيد" : "Good Standing")
                        }
                    </p>
                </div>
            </div>

            {/* Management Section */}
            <div className="luxury-card p-6">
                <h2 className="text-xl font-bold text-luxury-white mb-6 border-b border-gold/10 pb-4">
                    {language === "ar" ? "إدارة الملف الشخصي" : "Profile Management"}
                </h2>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-luxury-white/80 mb-2 font-medium">
                                {language === "ar" ? "اسم الزبون" : "Customer Name"}
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-4 py-3 bg-luxury-black border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder={language === "ar" ? "أدخل اسم الزبون..." : "Enter customer name..."}
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={() => setIsBlacklisted(!isBlacklisted)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-lg border transition-all font-bold w-full justify-center
                                    ${isBlacklisted
                                        ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                                        : 'bg-luxury-black text-luxury-white border-gold/30 hover:border-red-500 hover:text-red-400'
                                    }`}
                            >
                                <Ban className="h-5 w-5" />
                                {isBlacklisted
                                    ? (language === "ar" ? "إزالة من القائمة السوداء" : "Remove from Blacklist")
                                    : (language === "ar" ? "إضافة للقائمة السوداء" : "Add to Blacklist")
                                }
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-luxury-white/80 mb-2 font-medium">
                            {language === "ar" ? "ملاحظات إدارية (خفية)" : "Admin Notes (Private)"}
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full h-32 px-4 py-3 bg-luxury-black border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 resize-none"
                            placeholder={language === "ar" ? "أضف ملاحظات عن هذا العميل..." : "Add notes about this customer..."}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 bg-gold text-luxury-black rounded-lg hover:bg-gold-light font-bold disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Booking History */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-luxury-white flex items-center gap-2">
                    <HistoryIcon className="h-5 w-5 text-gold" />
                    {language === "ar" ? "سجل الحجوزات" : "Booking History"}
                </h2>

                <div className="bg-luxury-black/30 rounded-xl overflow-hidden border border-gold/10">
                    <table className="w-full text-luxury-white">
                        <thead className="bg-gold/10 text-gold text-sm uppercase tracking-wider font-bold">
                            <tr>
                                <th className="px-6 py-4 text-start">{language === "ar" ? "السيارة" : "Car"}</th>
                                <th className="px-6 py-4 text-start">{language === "ar" ? "التاريخ" : "Date"}</th>
                                <th className="px-6 py-4 text-start">{language === "ar" ? "المبلغ" : "Amount"}</th>
                                <th className="px-6 py-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                                <th className="px-6 py-4 text-start"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold/10">
                            {bookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-gold/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold">{booking.car?.name}</div>
                                        <div className="text-xs text-luxury-white/50">{booking.car?.model}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-luxury-white/80">
                                        {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gold">
                                        {formatCurrency(booking.total_amount, language)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusBadge(booking.status)}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-end">
                                        <Link
                                            href={`/admin/bookings/contract/${booking.id}`}
                                            className="text-xs text-gold hover:underline"
                                            target="_blank"
                                        >
                                            {language === "ar" ? "العقد" : "Contract"}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
