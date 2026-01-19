"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { Car, Branch } from "@/lib/types";
import { formatCurrency, calculateDays, calculateTotalAmount } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { getAllowedBranchIds } from "@/lib/auth-helpers";
import {
    Loader2,
    CheckCircle,
    ArrowLeft
} from "lucide-react";

type BookingStep = 1 | 2 | 3;

interface GroupedCar extends Car {
    count: number;
    availableIds: string[];
}

export default function AdminNewBookingPage() {
    const { language, dir } = useLanguage();
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState<BookingStep>(1);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [availableCars, setAvailableCars] = useState<Car[]>([]);
    const [selectedCar, setSelectedCar] = useState<Car | null>(null);
    const [loadingCars, setLoadingCars] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        // Step 1: Date & Time & Branch
        startDate: "",
        endDate: "",
        pickupTime: "10:00",
        branch: "", // branch_id
        // Step 3: Customer Info
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        nationalId: "",
        notes: "",
        paymentStatus: "paid" as "paid" | "pending",
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchBranches();
    }, []);

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

            const { data, error } = await query;

            if (!error && data) {
                setBranches(data);
                // Set default branch if available
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, branch: data[0].id }));
                }
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
                throw new Error(data.error || "Failed to fetch available cars");
            }

            setAvailableCars(data.cars || []);
        } catch (err: any) {
            console.error("Error fetching available cars:", err);
            setError(err.message || "Failed to fetch available cars");
        } finally {
            setLoadingCars(false);
        }
    }

    function validateStep1(): boolean {
        const errors: Record<string, string> = {};

        if (!formData.startDate) errors.startDate = language === "ar" ? "تاريخ البدء مطلوب" : "Start Date is required";
        if (!formData.endDate) {
            errors.endDate = language === "ar" ? "تاريخ الانتهاء مطلوب" : "End Date is required";
        } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            errors.endDate = language === "ar" ? "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء" : "End Date must be after Start Date";
        }
        if (!formData.branch) errors.branch = language === "ar" ? "الفرع مطلوب" : "Branch is required";

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
            if (selectedCar) {
                setCurrentStep(3);
            } else {
                setError(language === "ar" ? "يرجى اختيار سيارة" : "Please select a car");
            }
        }
    }

    function validateStep3(): boolean {
        const errors: Record<string, string> = {};
        if (!formData.customerName.trim()) errors.customerName = language === "ar" ? "اسم العميل مطلوب" : "Customer Name is required";
        if (!formData.customerPhone.trim()) errors.customerPhone = language === "ar" ? "رقم الهاتف مطلوب" : "Phone is required";

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
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

            const selectedBranch = branches.find(b => b.id === formData.branch);
            const branchName = selectedBranch ? `${selectedBranch.name_ar} - ${selectedBranch.name}` : formData.branch;

            // Insert Booking directly as Confirmed
            const { data: booking, error: insertError } = await supabase
                .from("bookings")
                .insert({
                    car_id: selectedCar.id,
                    customer_name: formData.customerName,
                    customer_phone: formData.customerPhone,
                    customer_email: formData.customerEmail || null,
                    national_id: formData.nationalId || null,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    pickup_time: formData.pickupTime,
                    branch: branchName,
                    branch_id: formData.branch, // branch_id from state
                    total_amount: totalAmount,
                    notes: formData.notes || "Direct Booking from Admin Panel",
                    status: "confirmed", // Auto confirm for admin
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setBookingId(booking.id);
            setSuccess(true);
        } catch (err: any) {
            console.error("Error creating booking:", err);
            setError(err.message || "Failed to create booking");
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

    // Group cars logic (same as public)
    const groupedCars = availableCars.reduce((acc, car) => {
        const key = `${car.name}-${car.model}-${car.year}`;
        if (!acc[key]) {
            acc[key] = { ...car, count: 1, availableIds: [car.id] };
        } else {
            acc[key].count++;
            acc[key].availableIds.push(car.id);
        }
        return acc;
    }, {} as Record<string, GroupedCar>);
    const uniqueCars = Object.values(groupedCars);

    if (success) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center">
                <div className="luxury-card flex flex-col items-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
                    <h1 className="text-2xl font-bold text-luxury-white mb-4">
                        {language === "ar" ? "تم تأكيد الحجز!" : "Booking Confirmed!"}
                    </h1>
                    <p className="text-luxury-white/60 mb-8">
                        {language === "ar" ? "تم إنشاء الحجز وتأكيده بنجاح." : "The booking has been successfully created and confirmed."}
                    </p>
                    <div className="flex gap-4">
                        <button onClick={() => router.push("/admin/bookings")} className="btn-gold">
                            {language === "ar" ? "شاهد الحجوزات" : "Go to Bookings"}
                        </button>
                        {bookingId && (
                            <button onClick={() => router.push(`/admin/bookings/contract/${bookingId}`)} className="px-6 py-3 rounded-lg border border-gold/30 text-gold hover:bg-gold/10">
                                {language === "ar" ? "طباعة العقد" : "Print Contract"}
                            </button>
                        )}
                        <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-lg bg-luxury-gray text-luxury-white hover:bg-luxury-gray/80">
                            {language === "ar" ? "حجز جديد" : "New Booking"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8" dir={dir}>
            <h1 className="text-3xl font-bold text-luxury-white mb-8">
                {language === "ar" ? "حجز مباشر جديد" : "New Direct Booking"}
            </h1>

            {/* Steps Indicator */}
            <div className="flex items-center justify-center mb-8">
                <div className="flex gap-4 text-sm font-medium">
                    <span className={currentStep === 1 ? "text-gold" : "text-luxury-white/40"}>
                        {language === "ar" ? "1. التاريخ والموقع" : "1. Dates & Branch"}
                    </span>
                    <span className="text-luxury-white/20">/</span>
                    <span className={currentStep === 2 ? "text-gold" : "text-luxury-white/40"}>
                        {language === "ar" ? "2. اختيار السيارة" : "2. Select Car"}
                    </span>
                    <span className="text-luxury-white/20">/</span>
                    <span className={currentStep === 3 ? "text-gold" : "text-luxury-white/40"}>
                        {language === "ar" ? "3. بيانات العميل" : "3. Customer Details"}
                    </span>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* STEP 1: Branch & Dates */}
            {currentStep === 1 && (
                <div className="luxury-card max-w-2xl mx-auto">
                    <h2 className="text-xl font-semibold text-luxury-white mb-6">
                        {language === "ar" ? "اختر التواريخ والموقع" : "Select Dates & Location"}
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm text-luxury-white/70 mb-2">
                                {language === "ar" ? "الفرع" : "Branch"}
                            </label>
                            <select
                                value={formData.branch}
                                onChange={e => setFormData({ ...formData, branch: e.target.value })}
                                className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                            >
                                <option value="">{language === "ar" ? "اختر الفرع" : "Select Branch"}</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {language === "ar" ? b.name_ar : b.name}
                                    </option>
                                ))}
                            </select>
                            {formErrors.branch && <p className="text-red-400 text-sm mt-1">{formErrors.branch}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-luxury-white/70 mb-2">
                                    {language === "ar" ? "تاريخ الاستلام" : "Start Date"}
                                </label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    min={new Date().toISOString().split("T")[0]}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                />
                                {formErrors.startDate && <p className="text-red-400 text-sm mt-1">{formErrors.startDate}</p>}
                            </div>
                            <div>
                                <label className="block text-sm text-luxury-white/70 mb-2">
                                    {language === "ar" ? "تاريخ الارجاع" : "End Date"}
                                </label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    min={formData.startDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                />
                                {formErrors.endDate && <p className="text-red-400 text-sm mt-1">{formErrors.endDate}</p>}
                            </div>
                        </div>

                        <button
                            onClick={handleNextStep}
                            className="btn-gold w-full py-3 flex justify-center items-center gap-2"
                            disabled={loadingCars}
                        >
                            {loadingCars ? <Loader2 className="animate-spin" /> : (language === "ar" ? "بحث عن السيارات المتاحة" : "Search Available Cars")}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: Select Car */}
            {currentStep === 2 && (
                <div>
                    <button onClick={() => setCurrentStep(1)} className="text-luxury-white/60 hover:text-gold mb-6 flex items-center gap-2">
                        <ArrowLeft className={`h-4 w-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                        {language === "ar" ? "تغيير التواريخ" : "Change Dates"}
                    </button>

                    <h2 className="text-xl font-semibold text-luxury-white mb-6">
                        {language === "ar" ? `السيارات المتاحة (${availableCars.length})` : `Available Cars (${availableCars.length})`}
                    </h2>

                    {uniqueCars.length === 0 ? (
                        <div className="text-center py-12 text-luxury-white/50">
                            {language === "ar" ? "لا توجد سيارات متاحة للبحث المحدد" : "No cars available for selected criteria."}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {uniqueCars.map(car => (
                                <div
                                    key={car.id}
                                    onClick={() => setSelectedCar(car)}
                                    className={`luxury-card cursor-pointer border-2 transition-all ${selectedCar?.id === car.id ? 'border-gold bg-gold/5' : 'border-transparent hover:border-gold/30'}`}
                                >
                                    <div className="relative h-48 mb-4 rounded bg-black/40">
                                        <Image src={getImageUrl(car.images[0])} alt={car.name} fill className="object-cover rounded" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-luxury-white">
                                                {language === "ar" && car.name_ar ? car.name_ar : car.name}
                                            </h3>
                                            <p className="text-sm text-luxury-white/60">{car.model} • {car.year}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gold">{formatCurrency(car.daily_rate, language)}</p>
                                            <p className="text-xs text-luxury-white/50">
                                                {language === "ar" ? "/ يوم" : "/ day"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedCar && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-luxury-black border-t border-gold/20 flex justify-center z-10">
                            <button onClick={handleNextStep} className="btn-gold px-12 py-3 shadow-lg shadow-gold/20">
                                {language === "ar" ? "متابعة" : "Continue"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 3: Customer Details */}
            {currentStep === 3 && selectedCar && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <button onClick={() => setCurrentStep(2)} className="text-luxury-white/60 hover:text-gold flex items-center gap-2">
                            <ArrowLeft className={`h-4 w-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                            {language === "ar" ? "تغيير السيارة" : "Change Car"}
                        </button>

                        <div className="luxury-card">
                            <h2 className="text-xl font-semibold text-luxury-white mb-6">
                                {language === "ar" ? "بيانات العميل" : "Customer Details"}
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-luxury-white/70 mb-2">
                                        {language === "ar" ? "الاسم الكامل *" : "Full Name *"}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                        placeholder={language === "ar" ? "أدخل اسم العميل" : "Enter customer name"}
                                    />
                                    {formErrors.customerName && <p className="text-red-400 text-sm mt-1">{formErrors.customerName}</p>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-luxury-white/70 mb-2">
                                            {language === "ar" ? "رقم الهاتف *" : "Phone Number *"}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.customerPhone}
                                            onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                            className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                            placeholder="+964..."
                                            dir="ltr"
                                        />
                                        {formErrors.customerPhone && <p className="text-red-400 text-sm mt-1">{formErrors.customerPhone}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm text-luxury-white/70 mb-2">
                                            {language === "ar" ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.customerEmail}
                                            onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                                            className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-luxury-white/70 mb-2">
                                        {language === "ar" ? "رقم الهوية / الجواز (اختياري)" : "National ID / Passport (Optional)"}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nationalId}
                                        onChange={e => setFormData({ ...formData, nationalId: e.target.value })}
                                        className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-luxury-white/70 mb-2">
                                        {language === "ar" ? "ملاحظات" : "Notes"}
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full bg-luxury-gray border border-gold/20 rounded-lg px-4 py-3 text-luxury-white focus:border-gold/50 outline-none h-24 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="btn-gold w-full py-4 text-lg font-bold flex justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" /> : (language === "ar" ? "تأكيد الحجز" : "Confirm Booking")}
                        </button>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="luxury-card sticky top-8">
                            <h3 className="text-lg font-bold text-luxury-white mb-4">
                                {language === "ar" ? "الملخص" : "Summary"}
                            </h3>
                            <div className="rounded-lg overflow-hidden mb-4">
                                <div className="relative h-32 w-full">
                                    <Image src={getImageUrl(selectedCar.images[0])} alt={selectedCar.name} fill className="object-cover" />
                                </div>
                            </div>
                            <h4 className="font-bold text-gold">
                                {language === "ar" && selectedCar.name_ar ? selectedCar.name_ar : selectedCar.name}
                            </h4>
                            <p className="text-sm text-luxury-white/60 mb-4">{selectedCar.model}</p>

                            <div className="space-y-2 text-sm border-t border-gold/10 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-luxury-white/60">
                                        {language === "ar" ? "التواريخ" : "Dates"}
                                    </span>
                                    <span className="text-luxury-white" dir="ltr">{formData.startDate} - {formData.endDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-luxury-white/60">
                                        {language === "ar" ? "المدة" : "Duration"}
                                    </span>
                                    <span className="text-luxury-white">
                                        {totalDays} {language === "ar" ? "أيام" : "Days"}
                                    </span>
                                </div>
                                <div className="flex justify-between font-bold text-gold pt-2 border-t border-gold/10 mt-2">
                                    <span>
                                        {language === "ar" ? "المبلغ الإجمالي" : "Total Amount"}
                                    </span>
                                    <span>{formatCurrency(totalAmount, language)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
