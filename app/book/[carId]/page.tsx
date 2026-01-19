
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { Car } from "@/lib/types";
import { formatCurrency, calculateDays, calculateTotalAmount } from "@/lib/utils";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import {
    ArrowLeft,
    Calendar,
    User,
    Phone,
    Mail,
    FileText,
    Loader2,
    CheckCircle,
    CreditCard,
    MapPin,
    Clock,
    ChevronRight
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Branch {
    id: string;
    name: string;
    name_ar: string;
    address?: string;
}

export default function BookingPage() {
    const { language, t, dir } = useLanguage();
    const params = useParams();
    const router = useRouter();
    const carId = params.carId as string;

    const [car, setCar] = useState<Car | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        startDate: "",
        endDate: "",
        pickupTime: "",
        branch: "",
        notes: "",
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (carId) {
            fetchCar();
            fetchBranches();
        }
    }, [carId]);

    async function fetchCar() {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from("cars")
                .select("*, category:categories(*)")
                .eq("id", carId)
                .single();

            if (fetchError) throw fetchError;
            setCar(data);
        } catch (err: any) {
            console.error("Error fetching car:", err);
            setError(err.message || (dir === 'rtl' ? "فشل تحميل تفاصيل السيارة" : "Failed to load car details"));
        } finally {
            setLoading(false);
        }
    }

    async function fetchBranches() {
        try {
            // Fetch only branches where this car is available
            const { data, error } = await supabase
                .from("branches")
                .select("*, car_branches!inner(car_id)")
                .eq("is_active", true)
                .eq("car_branches.car_id", carId)
                .order("name");

            if (!error && data) {
                setBranches(data);

                // If the currently selected branch is not in the new valid list, clear it
                if (data.length > 0) {
                    // Check if current form branch is valid
                    const isValid = data.some(b => b.id === formData.branch);
                    if (!isValid && formData.branch) {
                        setFormData(prev => ({ ...prev, branch: "" }));
                    }
                } else {
                    // Handle case where car has no branches (edge case)
                    console.warn("No branches found for this car");
                }
            }
        } catch (err) {
            console.error("Error fetching branches:", err);
        }
    }

    function validateForm(): boolean {
        const errors: Record<string, string> = {};

        if (!formData.customerName.trim()) {
            errors.customerName = t("common.required");
        }

        if (!formData.customerPhone.trim()) {
            errors.customerPhone = t("common.required");
        } else if (!/^[\d+\-\s()]+$/.test(formData.customerPhone)) {
            errors.customerPhone = dir === 'rtl' ? "صيغة رقم الهاتف غير صحيحة" : "Invalid phone format";
        }

        if (formData.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
            errors.customerEmail = dir === 'rtl' ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email format";
        }

        if (!formData.startDate) {
            errors.startDate = t("common.required");
        }

        if (!formData.endDate) {
            errors.endDate = t("common.required");
        } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            errors.endDate = dir === 'rtl' ? "تاريخ الإرجاع يجب أن يكون بعد تاريخ الاستلام" : "Return date must be after pickup date";
        }

        if (!formData.branch) {
            errors.branch = t("common.required");
        }

        if (!formData.pickupTime) {
            errors.pickupTime = t("common.required");
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!validateForm() || !car) return;

        try {
            setSubmitting(true);
            setError(null);

            const totalAmount = calculateTotalAmount(
                car.daily_rate,
                formData.startDate,
                formData.endDate
            );

            // Find the selected branch object to get its name
            const selectedBranchObj = branches.find(b => b.id === formData.branch);
            const branchName = selectedBranchObj ? `${selectedBranchObj.name_ar} - ${selectedBranchObj.name}` : '';

            const { error: insertError } = await supabase
                .from("bookings")
                .insert({
                    car_id: car.id,
                    customer_name: formData.customerName,
                    customer_phone: formData.customerPhone,
                    customer_email: formData.customerEmail || null,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    pickup_time: formData.pickupTime,
                    branch: branchName, // Human readable branch name
                    branch_id: formData.branch, // UUID for RLS filtering
                    total_amount: totalAmount,
                    notes: formData.notes || null,
                    status: "pending",
                });

            if (insertError) throw insertError;

            // Send Telegram Notification
            try {
                fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'new_booking',
                        data: {
                            customerName: formData.customerName,
                            phone: formData.customerPhone,
                            carName: language === 'ar' && car.name_ar ? car.name_ar : car.name,
                            startDate: formData.startDate,
                            endDate: formData.endDate,
                            pickupTime: formData.pickupTime,
                            branch: branchName,
                            notes: formData.notes,
                            days: calculateDays(formData.startDate, formData.endDate)
                        }
                    })
                });
            } catch (notifyError) {
                console.error("Failed to trigger notification:", notifyError);
                // Don't fail the booking if notification fails
            }

            setSuccess(true);
        } catch (err: any) {
            console.error("Error creating booking:", err);
            setError(err.message || (dir === 'rtl' ? "فشل في إنشاء الحجز. يرجى المحاولة مرة أخرى." : "Failed to create booking. Please try again."));
        } finally {
            setSubmitting(false);
        }
    }

    const totalDays = formData.startDate && formData.endDate
        ? calculateDays(formData.startDate, formData.endDate)
        : 0;

    const totalAmount = car && totalDays > 0
        ? calculateTotalAmount(car.daily_rate, formData.startDate, formData.endDate)
        : 0;

    const today = new Date().toISOString().split("T")[0];

    if (loading) {
        return (
            <div dir={dir}>
                <Navbar />
                <div className="min-h-screen bg-luxury-black flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-gold animate-spin" />
                </div>
                <Footer />
            </div>
        );
    }

    if (error && !car) {
        return (
            <div dir={dir}>
                <Navbar />
                <div className="min-h-screen bg-luxury-black flex flex-col items-center justify-center px-4">
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <Link href="/cars" className="btn-gold">
                        {t("booking.backToFleet")}
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    if (success) {
        return (
            <div dir={dir}>
                <Navbar />
                <div className="min-h-screen bg-luxury-black flex items-center justify-center px-4">
                    <div className="luxury-card max-w-md w-full text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                        <h1 className="text-2xl font-bold text-luxury-white mb-4">
                            {t("booking.success")}
                        </h1>
                        <p className="text-luxury-white/70 mb-6">
                            {t("booking.successMessage")}
                        </p>
                        <div className="luxury-card bg-gold/10 border-gold/30 mb-6 text-start">
                            <div className="flex items-center gap-2 text-gold">
                                <CreditCard className="h-5 w-5" />
                                <span className="font-medium">{t("booking.payOnDeliveryTitle")}</span>
                            </div>
                            <p className="text-luxury-white/60 text-sm mt-2">
                                {t("booking.payOnDeliveryText")}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link href="/cars" className="btn-gold flex-1">
                                {t("booking.browseMore")}
                            </Link>
                            <Link href="/" className="glass-dark px-6 py-3 rounded-lg text-luxury-white font-semibold flex-1 text-center">
                                {t("booking.goHome")}
                            </Link>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Back Button */}
                    <Link
                        href={`/cars/${carId}`}
                        className="inline-flex items-center gap-2 text-luxury-white/60 hover:text-gold transition-colors mb-6"
                    >
                        {dir === 'rtl' ? <ChevronRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                        {t("booking.backToDetails")}
                    </Link>

                    <h1 className="text-3xl sm:text-4xl font-bold text-luxury-white mb-8">
                        {t("booking.title")} <span className="text-gold">{t("booking.titleHighlight")}</span>
                    </h1>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Booking Form */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Error Message */}
                                {error && (
                                    <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-start">
                                        {error}
                                    </div>
                                )}

                                {/* Personal Information */}
                                <div className="luxury-card text-start">
                                    <h2 className="text-xl font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                        <User className="h-5 w-5 text-gold" />
                                        {t("booking.personalInfo")}
                                    </h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="customerName" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                {t("booking.fullName")} *
                                            </label>
                                            <input
                                                type="text"
                                                id="customerName"
                                                value={formData.customerName}
                                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 ${formErrors.customerName ? "border-red-500" : "border-gold/20"
                                                    }`}
                                                placeholder={t("booking.fullNamePlaceholder")}
                                            />
                                            {formErrors.customerName && (
                                                <p className="text-red-400 text-sm mt-1">{formErrors.customerName}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="customerPhone" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                    {t("booking.phone")} *
                                                </label>
                                                <input
                                                    type="tel"
                                                    id="customerPhone"
                                                    value={formData.customerPhone}
                                                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                                    className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 ${formErrors.customerPhone ? "border-red-500" : "border-gold/20"
                                                        }`}
                                                    placeholder={t("booking.phonePlaceholder")}
                                                    dir="ltr"
                                                />
                                                {formErrors.customerPhone && (
                                                    <p className="text-red-400 text-sm mt-1">{formErrors.customerPhone}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor="customerEmail" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                    {t("booking.email")}
                                                </label>
                                                <input
                                                    type="email"
                                                    id="customerEmail"
                                                    value={formData.customerEmail}
                                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                                    className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 ${formErrors.customerEmail ? "border-red-500" : "border-gold/20"
                                                        }`}
                                                    placeholder={t("booking.emailPlaceholder")}
                                                    dir="ltr"
                                                />
                                                {formErrors.customerEmail && (
                                                    <p className="text-red-400 text-sm mt-1">{formErrors.customerEmail}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Branch Selection */}
                                <div className="luxury-card text-start">
                                    <h2 className="text-xl font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-gold" />
                                        {t("booking.branch")}
                                    </h2>

                                    <div>
                                        <label htmlFor="branch" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                            {t("booking.selectBranch")} *
                                        </label>
                                        <select
                                            id="branch"
                                            value={formData.branch}
                                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                            className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${formErrors.branch ? "border-red-500" : "border-gold/20"
                                                }`}
                                        >
                                            <option value="">{t("booking.selectBranchPlaceholder")}</option>
                                            {branches.map((branch) => (
                                                <option key={branch.id} value={branch.id}>
                                                    {language === 'ar' && branch.name_ar ? branch.name_ar : branch.name}
                                                </option>
                                            ))}
                                        </select>
                                        {formErrors.branch && (
                                            <p className="text-red-400 text-sm mt-1">{formErrors.branch}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Booking Dates & Time */}
                                <div className="luxury-card text-start">
                                    <h2 className="text-xl font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-gold" />
                                        {t("booking.rentalPeriod")}
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label htmlFor="startDate" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                {t("booking.pickupDate")} *
                                            </label>
                                            <input
                                                type="date"
                                                id="startDate"
                                                min={today}
                                                value={formData.startDate}
                                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${formErrors.startDate ? "border-red-500" : "border-gold/20"
                                                    }`}
                                            />
                                            {formErrors.startDate && (
                                                <p className="text-red-400 text-sm mt-1">{formErrors.startDate}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label htmlFor="endDate" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                {t("booking.returnDate")} *
                                            </label>
                                            <input
                                                type="date"
                                                id="endDate"
                                                min={formData.startDate || today}
                                                value={formData.endDate}
                                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${formErrors.endDate ? "border-red-500" : "border-gold/20"
                                                    }`}
                                            />
                                            {formErrors.endDate && (
                                                <p className="text-red-400 text-sm mt-1">{formErrors.endDate}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pickup Time */}
                                    <div>
                                        <label htmlFor="pickupTime" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                            {t("booking.pickupTime")} *
                                        </label>
                                        <input
                                            type="time"
                                            id="pickupTime"
                                            value={formData.pickupTime}
                                            onChange={(e) => setFormData({ ...formData, pickupTime: e.target.value })}
                                            className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${formErrors.pickupTime ? "border-red-500" : "border-gold/20"
                                                }`}
                                        />
                                        {formErrors.pickupTime && (
                                            <p className="text-red-400 text-sm mt-1">{formErrors.pickupTime}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Additional Notes */}
                                <div className="luxury-card text-start">
                                    <h2 className="text-xl font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-gold" />
                                        {t("booking.notes")}
                                    </h2>
                                    <textarea
                                        id="notes"
                                        rows={4}
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 resize-none"
                                        placeholder={t("booking.notesPlaceholder")}
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn-gold w-full text-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            {t("booking.processing")}
                                        </>
                                    ) : (
                                        t("booking.confirm")
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Booking Summary */}
                        <div className="lg:col-span-1">
                            <div className="luxury-card sticky top-24 text-start">
                                <h2 className="text-xl font-semibold text-luxury-white mb-4">
                                    {t("booking.summary")}
                                </h2>

                                {car && (
                                    <>
                                        {/* Car Preview */}
                                        <div className="relative aspect-video rounded-lg overflow-hidden mb-4">
                                            <Image
                                                src={getImageUrl(car.images[0] || "/placeholder-car.jpg")}
                                                alt={car.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>

                                        <h3 className="text-lg font-bold text-luxury-white">{car.name}</h3>
                                        {car.name_ar && (
                                            <p className="text-gold text-sm font-arabic">{car.name_ar}</p>
                                        )}
                                        <p className="text-luxury-white/60 text-sm mb-4">
                                            {car.model} • {car.year}
                                        </p>

                                        {formData.branch && (
                                            <div className="flex items-center gap-2 text-luxury-white/80 text-sm mb-2">
                                                <MapPin className="h-4 w-4 text-gold flex-shrink-0" />
                                                <span>
                                                    {branches.find(b => b.id === formData.branch)
                                                        ? (language === 'ar'
                                                            ? branches.find(b => b.id === formData.branch)?.name_ar
                                                            : branches.find(b => b.id === formData.branch)?.name)
                                                        : ""}
                                                </span>
                                            </div>
                                        )}

                                        {formData.pickupTime && (
                                            <div className="flex items-center gap-2 text-luxury-white/80 text-sm mb-4">
                                                <Clock className="h-4 w-4 text-gold" />
                                                <span dir="ltr">{formData.pickupTime}</span>
                                            </div>
                                        )}

                                        <div className="border-t border-gold/20 pt-4 space-y-3">
                                            <div className="flex justify-between text-luxury-white/80">
                                                <span>{t("booking.dailyPrice")}</span>
                                                <span>{formatCurrency(car.daily_rate, language)}</span>
                                            </div>

                                            {totalDays > 0 && (
                                                <>
                                                    <div className="flex justify-between text-luxury-white/80">
                                                        <span>{t("booking.duration")}</span>
                                                        <span>{totalDays} {totalDays === 1 ? t("booking.day") : t("booking.days")}</span>
                                                    </div>

                                                    <div className="border-t border-gold/20 pt-3 flex justify-between text-lg font-bold">
                                                        <span className="text-luxury-white">{t("booking.total")}</span>
                                                        <span className="text-gold">{formatCurrency(totalAmount, language)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Pay on Delivery Notice */}
                                        <div className="mt-4 p-3 rounded-lg bg-gold/10 border border-gold/20">
                                            <div className="flex items-center gap-2 text-gold text-sm font-medium">
                                                <CreditCard className="h-4 w-4" />
                                                {t("booking.payOnDeliveryTitle")}
                                            </div>
                                            <p className="text-luxury-white/60 text-xs mt-1">
                                                {t("booking.noPaymentNow")}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
