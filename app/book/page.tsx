"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { Car } from "@/lib/types";
import { formatCurrency, calculateDays, calculateTotalAmount } from "@/lib/utils";
import { logAction } from "@/lib/audit";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { useLanguage } from "@/lib/language-context";
import { logBookingToN8n } from "@/app/actions/n8n";
import {
    ArrowLeft,
    ArrowRight,
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
    Car as CarIcon,
    Check
} from "lucide-react";

interface Branch {
    id: string;
    name: string;
    name_ar: string;
    address?: string;
}

const COUNTRY_CODES = [
    { code: "+964", label: "IQ (+964)" },
    { code: "+971", label: "UAE (+971)" },
    { code: "+966", label: "KSA (+966)" },
    { code: "+965", label: "KW (+965)" },
    { code: "+974", label: "QA (+974)" },
    { code: "+968", label: "OM (+968)" },
    { code: "+973", label: "BH (+973)" },
    { code: "+962", label: "JO (+962)" },
    { code: "+90", label: "TR (+90)" },
    { code: "+1", label: "US (+1)" },
    { code: "+44", label: "UK (+44)" },
];

type BookingStep = 1 | 2 | 3;

interface GroupedCar extends Car {
    count: number;
    availableIds: string[];
}

export default function BookingPage() {
    const { language, t, dir } = useLanguage();
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState<BookingStep>(1);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [availableCars, setAvailableCars] = useState<Car[]>([]);
    const [selectedCar, setSelectedCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingCars, setLoadingCars] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        // Step 1: Date & Time
        startDate: "",
        endDate: "",
        pickupTime: "",
        branch: "", // Stores branch_id now
        // Step 3: Personal Info
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        notes: "",
    });

    const [countryCode, setCountryCode] = useState("+964");

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchBranches();
    }, []);

    async function fetchBranches() {
        try {
            const { data, error } = await supabase
                .from("branches")
                .select("*")
                .eq("is_active", true)
                .order("name");

            if (!error && data) {
                setBranches(data);
            }
        } catch (err) {
            console.error("Error fetching branches:", err);
        }
    }

    async function fetchAvailableCars() {
        if (!formData.startDate || !formData.endDate || !formData.branch) return;

        try {
            setLoadingCars(true);
            setError(null);

            const response = await fetch(
                `/api/available-cars?start_date=${formData.startDate}&end_date=${formData.endDate}&branch_id=${formData.branch}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || (dir === 'rtl' ? "فشل في جلب السيارات المتوفرة" : "Failed to fetch available cars"));
            }

            setAvailableCars(data.cars || []);
        } catch (err: any) {
            console.error("Error fetching available cars:", err);
            setError(err.message || (dir === 'rtl' ? "فشل في تحميل السيارات المتوفرة" : "Failed to load available cars"));
        } finally {
            setLoadingCars(false);
        }
    }

    function validateStep1(): boolean {
        const errors: Record<string, string> = {};

        if (!formData.startDate) {
            errors.startDate = t("common.required");
        }

        if (!formData.endDate) {
            errors.endDate = t("common.required");
        } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            errors.endDate = dir === 'rtl' ? "تاريخ الإرجاع يجب أن يكون بعد تاريخ الاستلام" : "Return date must be after pickup date";
        }

        if (!formData.pickupTime) {
            errors.pickupTime = t("common.required");
        }

        if (!formData.branch) {
            errors.branch = t("common.required");
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    function validateStep2(): boolean {
        if (!selectedCar) {
            setError(dir === 'rtl' ? "يرجى اختيار سيارة" : "Please select a car");
            return false;
        }
        return true;
    }

    function validateStep3(): boolean {
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

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleNextStep() {
        if (currentStep === 1) {
            if (validateStep1()) {
                await fetchAvailableCars();
                setCurrentStep(2);
            }
        } else if (currentStep === 2) {
            if (validateStep2()) {
                setCurrentStep(3);
            }
        }
    }

    function handlePrevStep() {
        if (currentStep === 2) {
            setCurrentStep(1);
            setSelectedCar(null);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!validateStep3() || !selectedCar) return;

        try {
            setSubmitting(true);
            setError(null);

            const totalAmount = calculateTotalAmount(
                selectedCar.daily_rate,
                formData.startDate,
                formData.endDate
            );

            // Get selected branch name for notification
            const selectedBranch = branches.find(b => b.id === formData.branch);
            const branchName = selectedBranch ? `${selectedBranch.name_ar} - ${selectedBranch.name}` : formData.branch;

            const { data: booking, error: insertError } = await supabase
                .from("bookings")
                .insert({
                    car_id: selectedCar.id,
                    customer_name: formData.customerName,
                    customer_phone: `${countryCode} ${formData.customerPhone}`,
                    customer_email: formData.customerEmail || null,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    pickup_time: formData.pickupTime,
                    branch: branchName, // Human readable branch name
                    branch_id: formData.branch, // UUID for RLS filtering
                    total_amount: totalAmount,
                    notes: formData.notes || null,
                    status: "pending",
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Log New Booking
            await logAction(
                'NEW_BOOKING_REQUEST',
                'pending', // Using 'pending' as resource ID or similar since we might not have ID returned unless we select
                `Customer: ${formData.customerName} | Branch: ${branchName} | Total: ${totalAmount}`
            );

            // Log to N8n
            await logBookingToN8n({
                ...booking,
                car_name: language === "ar" && selectedCar.name_ar ? selectedCar.name_ar : selectedCar.name,
                source: 'public_website'
            });

            // Send Telegram Notification
            try {
                fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'new_booking',
                        data: {
                            customerName: formData.customerName,
                            phone: `${countryCode} ${formData.customerPhone}`,
                            carName: language === 'ar' && selectedCar.name_ar ? selectedCar.name_ar : selectedCar.name,
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

    const totalAmount = selectedCar && totalDays > 0
        ? calculateTotalAmount(selectedCar.daily_rate, formData.startDate, formData.endDate)
        : 0;

    const today = new Date().toISOString().split("T")[0];

    // Helper to group identical cars
    const groupedCars = availableCars.reduce((acc, car) => {
        const key = `${car.name}-${car.model}-${car.year}`;
        if (!acc[key]) {
            acc[key] = {
                ...car,
                count: 1,
                availableIds: [car.id]
            };
        } else {
            acc[key].count++;
            acc[key].availableIds.push(car.id);
        }
        return acc;
    }, {} as Record<string, GroupedCar>);

    const uniqueCars = Object.values(groupedCars);

    const getBranchName = (id: string) => {
        const b = branches.find(branch => branch.id === id);
        return b ? (language === 'ar' ? b.name_ar : b.name) : "";
    };

    // Success Screen
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl sm:text-4xl font-bold text-luxury-white mb-4">
                            {t("booking.title")} <span className="text-gold">{t("booking.titleHighlight")}</span>
                        </h1>
                        <p className="text-luxury-white/70">
                            {t("booking.selectDatePrompt")}
                        </p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center mb-8">
                        <div className="flex items-center gap-2 sm:gap-4">
                            {[1, 2, 3].map((step) => (
                                <div key={step} className="flex items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${currentStep >= step
                                            ? "bg-gold text-luxury-black"
                                            : "bg-luxury-gray text-luxury-white/50"
                                            }`}
                                    >
                                        {currentStep > step ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            step
                                        )}
                                    </div>
                                    {step < 3 && (
                                        <div
                                            className={`w-12 sm:w-20 h-1 mx-2 rounded transition-all ${currentStep > step ? "bg-gold" : "bg-luxury-gray"
                                                }`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step Labels */}
                    <div className="flex justify-center mb-8">
                        <div className="text-center">
                            <p className="text-gold font-semibold">
                                {currentStep === 1 && t("booking.step1Title")}
                                {currentStep === 2 && t("booking.step2Title")}
                                {currentStep === 3 && t("booking.step3Title")}
                            </p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-start">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Date & Time Selection */}
                    {currentStep === 1 && (
                        <div className="max-w-2xl mx-auto">
                            <div className="luxury-card text-start">
                                <h2 className="text-xl font-semibold text-luxury-white mb-6 flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-gold" />
                                    {t("booking.rentalPeriod")}
                                </h2>

                                <div className="space-y-6">
                                    {/* Branch Selection */}
                                    <div>
                                        <label htmlFor="branch" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                            <MapPin className="h-4 w-4 inline mr-1" />
                                            {t("booking.branch")} *
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

                                    {/* Dates */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="startDate" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                تاريخ الاستلام *
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
                                                تاريخ الإرجاع *
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
                                            <Clock className="h-4 w-4 inline ml-1" />
                                            وقت الاستلام *
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

                                    {/* Duration Preview */}
                                    {totalDays > 0 && (
                                        <div className="p-4 rounded-lg bg-gold/10 border border-gold/20">
                                            <p className="text-gold font-medium">
                                                مدة الإيجار: {totalDays} {totalDays === 1 ? "يوم" : "أيام"}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Next Button */}
                                <div className="mt-8">
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        disabled={loadingCars}
                                        className="btn-gold w-full text-lg py-4 flex items-center justify-center gap-2"
                                    >
                                        {loadingCars ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                {t("booking.processing")}
                                            </>
                                        ) : (
                                            <>
                                                {t("booking.searchCars")}
                                                {dir === 'rtl' ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Car Selection */}
                    {currentStep === 2 && (
                        <div>
                            {/* Back Button */}
                            <button
                                onClick={handlePrevStep}
                                className="inline-flex items-center gap-2 text-luxury-white/60 hover:text-gold transition-colors mb-6"
                            >
                                {dir === 'rtl' ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                                {t("booking.changeDates")}
                            </button>

                            {/* Selected Dates Summary */}
                            <div className="luxury-card mb-6 flex flex-wrap items-center gap-4 text-start">
                                <div className="flex items-center gap-2 text-luxury-white">
                                    <Calendar className="h-4 w-4 text-gold" />
                                    <span dir="ltr">{formData.startDate} - {formData.endDate}</span>
                                </div>
                                <div className="flex items-center gap-2 text-luxury-white">
                                    <Clock className="h-4 w-4 text-gold" />
                                    <span dir="ltr">{formData.pickupTime}</span>
                                </div>
                                <div className="flex items-center gap-2 text-luxury-white">
                                    <MapPin className="h-4 w-4 text-gold" />
                                    <span>{getBranchName(formData.branch)}</span>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-gold/20 text-gold text-sm font-medium">
                                    {totalDays} {totalDays === 1 ? t("booking.day") : t("booking.days")}
                                </div>
                            </div>

                            {/* Available Cars */}
                            <h2 className="text-xl font-semibold text-luxury-white mb-4 text-start">
                                {t("booking.availableCarsCount")} ({availableCars.length})
                            </h2>

                            {uniqueCars.length === 0 ? (
                                <div className="luxury-card text-center py-12">
                                    <CarIcon className="h-16 w-16 text-luxury-white/30 mx-auto mb-4" />
                                    <p className="text-luxury-white/60 text-lg">
                                        {t("booking.noAvailableCars")}
                                    </p>
                                    <p className="text-luxury-white/40 mt-2">
                                        {t("booking.tryDifferentDates")}
                                    </p>
                                    <button
                                        onClick={handlePrevStep}
                                        className="btn-gold mt-6"
                                    >
                                        {t("booking.changeDates")}
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {uniqueCars.map((car) => {
                                        return (
                                            <div
                                                key={car.id}
                                                onClick={() => setSelectedCar(car)}
                                                className={`luxury-card cursor-pointer transition-all hover:border-gold/50 text-start ${selectedCar?.id === car.id
                                                    ? "border-gold ring-2 ring-gold/30"
                                                    : ""
                                                    }`}
                                            >
                                                {/* Car Image */}
                                                <div className="relative h-40 rounded-lg overflow-hidden mb-4">
                                                    <Image
                                                        src={getImageUrl(car.images[0] || "/placeholder-car.jpg")}
                                                        alt={car.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                    {selectedCar?.id === car.id && (
                                                        <div className="absolute top-2 right-2 w-8 h-8 bg-gold rounded-full flex items-center justify-center">
                                                            <Check className="h-5 w-5 text-luxury-black" />
                                                        </div>
                                                    )}

                                                    {/* Available Count Badge */}
                                                    {(car as any).count > 1 && (
                                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white border border-white/20">
                                                            {(car as any).count} {t("booking.carsAvailableBadge")}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Car Info */}
                                                <h3 className="text-lg font-bold text-luxury-white">
                                                    {car.name}
                                                </h3>
                                                {car.name_ar && (
                                                    <p className="text-gold text-sm font-arabic">{car.name_ar}</p>
                                                )}
                                                <p className="text-luxury-white/60 text-sm">
                                                    {car.model} • {car.year}
                                                </p>

                                                {/* Price */}
                                                <div className="mt-4 pt-4 border-t border-gold/20">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="text-gold font-bold text-xl">
                                                                {formatCurrency(car.daily_rate, language)}
                                                            </p>
                                                            <p className="text-luxury-white/50 text-xs">{t("cars.perDay")}</p>
                                                        </div>
                                                        <div className="text-start">
                                                            <p className="text-luxury-white font-semibold">
                                                                {formatCurrency(car.daily_rate * totalDays, language)}
                                                            </p>
                                                            <p className="text-luxury-white/50 text-xs">{t("booking.total")}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Next Button */}
                            {availableCars.length > 0 && (
                                <div className="mt-8 max-w-md mx-auto">
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        disabled={!selectedCar}
                                        className="btn-gold w-full text-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t("booking.continue")}
                                        {dir === 'rtl' ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Personal Information */}
                    {currentStep === 3 && selectedCar && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Form */}
                            <div className="lg:col-span-2">
                                {/* Back Button */}
                                <button
                                    onClick={handlePrevStep}
                                    className="inline-flex items-center gap-2 text-luxury-white/60 hover:text-gold transition-colors mb-6"
                                >
                                    {dir === 'rtl' ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                                    {t("booking.changeCar")}
                                </button>

                                <form onSubmit={handleSubmit} className="space-y-6">
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
                                                    className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 h-[50px] ${formErrors.customerName ? "border-red-500" : "border-gold/20"
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
                                                        <Phone className="h-4 w-4 inline ml-1" />
                                                        {t("booking.phone")} *
                                                    </label>
                                                    <div className="flex gap-2" dir="ltr">
                                                        <select
                                                            value={countryCode}
                                                            onChange={(e) => setCountryCode(e.target.value)}
                                                            className="w-[110px] sm:w-[130px] px-2 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 text-sm h-[50px]"
                                                        >
                                                            {COUNTRY_CODES.map((country) => (
                                                                <option key={country.code} value={country.code}>
                                                                    {country.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="tel"
                                                            id="customerPhone"
                                                            value={formData.customerPhone}
                                                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                                            className={`flex-1 px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 h-[50px] ${formErrors.customerPhone ? "border-red-500" : "border-gold/20"
                                                                }`}
                                                            placeholder="7xx xxx xxxx"
                                                        />
                                                    </div>
                                                    {formErrors.customerPhone && (
                                                        <p className="text-red-400 text-sm mt-1">{formErrors.customerPhone}</p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label htmlFor="customerEmail" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                        <Mail className="h-4 w-4 inline ml-1" />
                                                        {t("booking.email")}
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="customerEmail"
                                                        value={formData.customerEmail}
                                                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                                        className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 h-[50px] ${formErrors.customerEmail ? "border-red-500" : "border-gold/20"
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

                                    {/* Car Preview */}
                                    {selectedCar && (
                                        <>
                                            <div className="relative aspect-video rounded-lg overflow-hidden mb-4">
                                                <Image
                                                    src={getImageUrl(selectedCar.images[0] || "/placeholder-car.jpg")}
                                                    alt={selectedCar.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>

                                            <h3 className="text-lg font-bold text-luxury-white">{selectedCar.name}</h3>
                                            {selectedCar.name_ar && (
                                                <p className="text-gold text-sm font-arabic">{selectedCar.name_ar}</p>
                                            )}
                                            <p className="text-luxury-white/60 text-sm mb-4">
                                                {selectedCar.model} • {selectedCar.year}
                                            </p>
                                        </>
                                    )}

                                    <div className="flex items-center gap-2 text-luxury-white/80 text-sm mb-2">
                                        <MapPin className="h-4 w-4 text-gold" />
                                        <span>{getBranchName(formData.branch)}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-luxury-white/80 text-sm mb-2">
                                        <Calendar className="h-4 w-4 text-gold" />
                                        <span dir="ltr">{formData.startDate} - {formData.endDate}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-luxury-white/80 text-sm mb-4">
                                        <Clock className="h-4 w-4 text-gold" />
                                        <span dir="ltr">{formData.pickupTime}</span>
                                    </div>

                                    {selectedCar && (
                                        <div className="border-t border-gold/20 pt-4 space-y-3">
                                            <div className="flex justify-between text-luxury-white/80">
                                                <span>{t("booking.dailyPrice")}</span>
                                                <span>{formatCurrency(selectedCar.daily_rate, language)}</span>
                                            </div>

                                            <div className="flex justify-between text-luxury-white/80">
                                                <span>{t("booking.duration")}</span>
                                                <span>{totalDays} {totalDays === 1 ? t("booking.day") : t("booking.days")}</span>
                                            </div>

                                            <div className="border-t border-gold/20 pt-3 flex justify-between text-lg font-bold">
                                                <span className="text-luxury-white">{t("booking.total")}</span>
                                                <span className="text-gold">{formatCurrency(totalAmount, language)}</span>
                                            </div>
                                        </div>
                                    )}

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
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
