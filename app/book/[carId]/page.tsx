"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { Car } from "@/lib/types";
import { formatCurrency, calculateDays, calculateTotalAmount } from "@/lib/utils";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    User,
    Phone,
    Mail,
    FileText,
    Loader2,
    CheckCircle,
    CreditCard,
    MapPin,
    Clock,
    ChevronRight,
    Check
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, isWithinInterval, startOfDay, parseISO, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";

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

    const [countryCode, setCountryCode] = useState("+964");

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Inventory State for Colors
    const [availableUnits, setAvailableUnits] = useState<any[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    // Calendar State
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [inventoryCount, setInventoryCount] = useState(0);
    const [allBookings, setAllBookings] = useState<any[]>([]);

    // Fetch Calendar Data (Inventory Count + All Bookings)
    useEffect(() => {
        if (carId) {
            fetchCalendarData();
            fetchCar();
            fetchBranches();
        }
    }, [carId]);

    // Sync formData to dateRange (initial load or external change)
    useEffect(() => {
        if (formData.startDate && formData.endDate && !dateRange) {
            setDateRange({
                from: parseISO(formData.startDate),
                to: parseISO(formData.endDate)
            });
        }
    }, [formData.startDate, formData.endDate]);

    async function fetchCalendarData() {
        try {
            // 1. Get Inventory Count
            const { count, error: countError } = await supabase
                .from("car_inventory")
                .select("id", { count: "exact", head: true })
                .eq("car_id", carId)
                .neq("status", "maintenance");

            if (countError) console.error("Error fetching count:", countError);
            setInventoryCount(count || 0);

            // 2. Get All Future Bookings
            const { data: bookings, error: bookError } = await supabase
                .from("bookings")
                .select("start_date, end_date")
                .eq("car_id", carId)
                .in("status", ["pending", "confirmed"])
                .gte("end_date", new Date().toISOString().split('T')[0]); // Bookings ending in future

            if (bookError) console.error("Error fetching bookings:", bookError);
            setAllBookings(bookings || []);

        } catch (err) {
            console.error("Calendar Data Error:", err);
        }
    }

    // Check if a date is fully booked
    const isDateDisabled = (date: Date) => {
        // 1. Past dates
        if (date < startOfDay(new Date())) return true;

        // 2. No inventory? 
        if (inventoryCount === 0) return true;

        // 3. Check Overlap Count
        const dateStr = format(date, 'yyyy-MM-dd');

        let activeBookings = 0;
        for (const b of allBookings) {
            if (dateStr >= b.start_date && dateStr <= b.end_date) {
                activeBookings++;
            }
        }

        return activeBookings >= inventoryCount;
    };

    const handleDateSelect = (range: DateRange | undefined) => {
        setDateRange(range);

        if (range?.from) {
            if (range.to) {
                // Check overlap
                let curr = range.from;
                let hasDisabled = false;
                // Limit loop 
                let limit = 0;
                while (curr <= range.to && limit < 365) {
                    if (isDateDisabled(curr)) {
                        hasDisabled = true;
                        break;
                    }
                    curr = addDays(curr, 1);
                    limit++;
                }

                if (hasDisabled) {
                    setDateRange({ from: range.from, to: undefined });
                    setFormData(prev => ({
                        ...prev,
                        startDate: format(range.from!, 'yyyy-MM-dd'),
                        endDate: ""
                    }));
                    return;
                }
            }

            setFormData(prev => ({
                ...prev,
                startDate: format(range.from!, 'yyyy-MM-dd'),
                endDate: range.to ? format(range.to, 'yyyy-MM-dd') : ""
            }));
        } else {
            setFormData(prev => ({ ...prev, startDate: "", endDate: "" }));
        }
    };

    // Trigger checkAvailability for Colors when dates change
    useEffect(() => {
        if (carId && formData.startDate && formData.endDate) {
            checkAvailability();
        }
    }, [carId, formData.startDate, formData.endDate]);

    async function checkAvailability() {
        try {
            setCheckingAvailability(true);
            setAvailableUnits([]);
            setSelectedUnit(null);

            // 1. Fetch Inventory
            const { data: inventory, error: invError } = await supabase
                .from("car_inventory")
                .select("*")
                .eq("car_id", carId)
                .neq("status", "maintenance");

            if (invError) throw invError;
            if (!inventory || inventory.length === 0) {
                return; // No inventory at all
            }

            // 2. Fetch Conflicting Bookings
            const { data: bookings, error: bookError } = await supabase
                .from("bookings")
                .select("inventory_id")
                .eq("car_id", carId)
                .in("status", ["pending", "confirmed"])
                .lte("start_date", formData.endDate)
                .gte("end_date", formData.startDate);

            if (bookError) throw bookError;

            // 3. Filter Available
            const bookedIds = new Set(bookings?.map(b => b.inventory_id).filter(Boolean));
            const available = inventory.filter(item => !bookedIds.has(item.id));

            setAvailableUnits(available);

        } catch (err) {
            console.error("Error checking availability:", err);
        } finally {
            setCheckingAvailability(false);
        }
    }

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
            const { data, error } = await supabase
                .from("branches")
                .select("*, car_branches!inner(car_id)")
                .eq("is_active", true)
                .eq("car_branches.car_id", carId)
                .order("name");

            if (!error && data) {
                setBranches(data);
                if (data.length > 0) {
                    const isValid = data.some(b => b.id === formData.branch);
                    if (!isValid && formData.branch) {
                        setFormData(prev => ({ ...prev, branch: "" }));
                    }
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

            // Append color notes if selected
            const finalNotes = selectedUnit
                ? `${formData.notes || ""} \n[System]: Client preferred color: ${selectedUnit.color} (Plate: ${selectedUnit.plate_number})`.trim()
                : formData.notes;

            // Conflict Check for Specific Unit
            if (selectedUnit) {
                const { data: conflicts } = await supabase
                    .from("bookings")
                    .select("id")
                    .eq("inventory_id", selectedUnit.id)
                    .in("status", ["pending", "confirmed"])
                    .lte("start_date", formData.endDate)
                    .gte("end_date", formData.startDate);

                if (conflicts && conflicts.length > 0) {
                    throw new Error(language === "ar" ? "هذه السيارة محجوزة مسبقاً في الفترة المحددة" : "This car is already reserved for the selected period");
                }
            }

            // Upsert Customer Profile to persist customer data
            // We check existence first to preserve the original name if already registered
            try {
                const customerPhone = `${countryCode} ${formData.customerPhone}`;
                const { data: existingProfile } = await supabase
                    .from("customer_profiles")
                    .select("phone_number")
                    .eq("phone_number", customerPhone)
                    .single();

                if (!existingProfile) {
                    await supabase.from("customer_profiles").insert({
                        phone_number: customerPhone,
                        full_name: formData.customerName,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    // Just update timestamp
                    await supabase.from("customer_profiles")
                        .update({ updated_at: new Date().toISOString() })
                        .eq("phone_number", customerPhone);
                }
            } catch (e) {
                console.warn("Failed to handle customer profile:", e);
            }

            const { data: newBooking, error: insertError } = await supabase
                .from("bookings")
                .insert({
                    car_id: car.id,
                    inventory_id: selectedUnit ? selectedUnit.id : null,
                    customer_name: formData.customerName,
                    customer_phone: `${countryCode} ${formData.customerPhone}`,
                    customer_email: formData.customerEmail || null,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    pickup_time: formData.pickupTime,
                    branch: branchName,
                    branch_id: formData.branch,
                    total_amount: totalAmount,
                    notes: finalNotes || null,
                    status: "pending",
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Log New Booking
            await logAction(
                'NEW_BOOKING_REQUEST',
                newBooking.id,
                [
                    `Customer: ${formData.customerName}`,
                    `Car: ${language === 'ar' && car.name_ar ? car.name_ar : car.name}`,
                    ...(selectedUnit ? [`Color: ${selectedUnit.color}`, `Plate: ${selectedUnit.plate_number}`] : []),
                    `Status: pending`
                ].join(' | ')
            );

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
                            carName: language === 'ar' && car.name_ar ? car.name_ar : car.name,
                            startDate: formData.startDate,
                            endDate: formData.endDate,
                            pickupTime: formData.pickupTime,
                            branch: branchName,
                            notes: finalNotes,
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                                                    {t("booking.phone")} *
                                                </label>
                                                <input
                                                    type="tel"
                                                    id="customerPhone"
                                                    value={formData.customerPhone}
                                                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                                    className="absolute inset-0 opacity-0 w-0 h-0"
                                                />
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
                                                        id="phoneVisible"
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

                                {/* Booking Dates & Calendar */}
                                <div className="luxury-card text-start">
                                    <h2 className="text-xl font-semibold text-luxury-white mb-4 flex items-center gap-2">
                                        <CalendarIcon className="h-5 w-5 text-gold" />
                                        {t("booking.rentalPeriod")}
                                    </h2>

                                    <div className="bg-luxury-gray/50 rounded-lg p-4 border border-gold/10 flex flex-col items-center mb-6">
                                        <style>{`
                                            .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #D4AF37; --rdp-background-color: #D4AF37; margin: 0; }
                                            .rdp-day_selected:not([disabled]) { color: black; font-weight: bold; }
                                            .rdp-button:hover:not([disabled]) { color: #D4AF37; }
                                         `}</style>
                                        <Calendar
                                            mode="range"
                                            selected={dateRange}
                                            onSelect={handleDateSelect}
                                            disabled={isDateDisabled}
                                            numberOfMonths={1}
                                            defaultMonth={new Date()}
                                            className="rounded-md border border-white/10 bg-luxury-gray text-luxury-white"
                                        />

                                        <div className="flex gap-4 mt-6 w-full">
                                            <div className="flex-1">
                                                <label className="text-xs text-luxury-white/50 block mb-1">{t("booking.pickupDate")}</label>
                                                <div className="px-3 py-2 bg-black/40 rounded border border-white/10 text-luxury-white text-sm">
                                                    {formData.startDate || "-"}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs text-luxury-white/50 block mb-1">{t("booking.returnDate")}</label>
                                                <div className="px-3 py-2 bg-black/40 rounded border border-white/10 text-luxury-white text-sm">
                                                    {formData.endDate || "-"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {formErrors.startDate && <p className="text-red-400 text-sm mt-2">{formErrors.startDate}</p>}
                                    {formErrors.endDate && <p className="text-red-400 text-sm mt-1">{formErrors.endDate}</p>}

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

                                {/* Color Selection */}
                                {availableUnits.length > 0 && (
                                    <div className="mb-6 animate-fadeIn">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            {language === "ar" ? "اختر لون السيارة (اختياري)" : "Preferred Car Color (Optional)"}
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {availableUnits.map((unit) => (
                                                <button
                                                    key={unit.id}
                                                    type="button"
                                                    onClick={() => setSelectedUnit(unit.id === selectedUnit?.id ? null : unit)}
                                                    className={`group relative p-1 rounded-full border-2 transition-all ${selectedUnit?.id === unit.id ? 'border-amber-500 scale-110' : 'border-transparent hover:border-gray-300'}`}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-full shadow-sm border border-gray-200"
                                                        style={{ backgroundColor: unit.color?.toLowerCase() }}
                                                        title={unit.color}
                                                    />
                                                    {selectedUnit?.id === unit.id && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <CheckCircle className="w-5 h-5 text-white drop-shadow-md" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedUnit && (
                                            <p className="text-xs text-amber-600 mt-2 font-medium">
                                                {language === "ar"
                                                    ? `تم اختيار اللون: ${selectedUnit.color}`
                                                    : `Selected Color: ${selectedUnit.color}`}
                                            </p>
                                        )}
                                    </div>
                                )}

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
