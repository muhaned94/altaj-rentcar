"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Booking, CarInventory } from "@/lib/types";
import { logAction } from "@/lib/audit";
import { formatCurrency, formatDate, getStatusBadge } from "@/lib/utils";
import {
    Calendar,
    Phone,
    Mail,
    MapPin,
    Car,
    User,
    FileText,
    X,
    Check,
    XCircle,
    RefreshCw,
    Printer,
} from "lucide-react";

interface BookingDetailsModalProps {
    booking: Booking;
    onClose: () => void;
    onUpdate: () => void;
    isOpen: boolean;
}

export default function BookingDetailsModal({
    booking,
    onClose,
    onUpdate,
    isOpen,
}: BookingDetailsModalProps) {
    const { t, language, dir } = useLanguage();
    const [updating, setUpdating] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Edit Form State
    const [status, setStatus] = useState<Booking['status']>(booking.status);
    const [targetInventoryId, setTargetInventoryId] = useState<string>(booking.inventory_id || "");
    const [startDate, setStartDate] = useState(booking.start_date);
    const [endDate, setEndDate] = useState(booking.end_date);
    const [pickupTime, setPickupTime] = useState(booking.pickup_time || "");
    const [branch, setBranch] = useState(booking.branch || "");
    const [adminNote, setAdminNote] = useState("");
    const [nationalId, setNationalId] = useState(booking.national_id || "");
    const [totalAmount, setTotalAmount] = useState(booking.total_amount);
    const [discountPercentage, setDiscountPercentage] = useState(booking.discount_percentage || 0);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Reset state when modal opens
            setStatus(booking.status);
            setTargetInventoryId(booking.inventory_id || "");
            setStartDate(booking.start_date);
            setEndDate(booking.end_date);
            setPickupTime(booking.pickup_time || "");
            setBranch(booking.branch || "");
            setPickupTime(booking.pickup_time || "");
            setBranch(booking.branch || "");
            setAdminNote("");
            setNationalId(booking.national_id || "");
            setTotalAmount(booking.total_amount);
            setDiscountPercentage(booking.discount_percentage || 0); // Initialize discount
            setIsEditMode(false);

            fetchInventory();
        }
    }, [isOpen, booking]);

    // Recalculate price on date change

    useEffect(() => {
        if (startDate && endDate && booking.car?.daily_rate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = end.getTime() - start.getTime();
            // Inclusive days calculation -> NOW EXCLUSIVE of return day
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                const subTotal = diffDays * booking.car.daily_rate;
                const discount = subTotal * ((discountPercentage || 0) / 100);
                setTotalAmount(subTotal - discount);
            }
        }
    }, [startDate, endDate, booking.car, discountPercentage]);

    async function fetchInventory() {
        if (!booking.car_id) return;
        const { data } = await supabase
            .from("car_inventory")
            .select("id, plate_number, color, status")
            .eq("car_id", booking.car_id)
            .neq("status", "maintenance");

        if (data) setInventoryItems(data);
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

    const handleSave = async (statusOverride?: string) => {
        try {
            setUpdating(true);
            const finalStatus = typeof statusOverride === 'string' ? statusOverride : status;

            // 1. Calculate Changes (Diff)
            const changes: string[] = [];
            if (finalStatus !== booking.status) changes.push(`Status: ${booking.status} -> ${finalStatus}`);
            if (targetInventoryId !== (booking.inventory_id || "")) {
                const oldPlate = inventoryItems.find(i => i.id === booking.inventory_id)?.plate_number || "None";
                const newPlate = inventoryItems.find(i => i.id === targetInventoryId)?.plate_number || "None";
                changes.push(`Car: ${oldPlate} -> ${newPlate}`);
            }
            if (startDate !== booking.start_date) changes.push(`Start: ${booking.start_date} -> ${startDate}`);
            if (endDate !== booking.end_date) changes.push(`End: ${booking.end_date} -> ${endDate}`);
            if (totalAmount !== booking.total_amount) {
                changes.push(`Price: ${formatCurrency(booking.total_amount)} -> ${formatCurrency(totalAmount)}`);
            }

            // 2. Prepare Updates
            const updates: any = {
                status: finalStatus,
                start_date: startDate,
                end_date: endDate,
                pickup_time: pickupTime || null,
                branch: branch, // Keep branch as string, assuming DB column is text
                national_id: nationalId || null,
                total_amount: totalAmount,
                discount_percentage: discountPercentage,
            };

            // Inventory Logic
            if (targetInventoryId !== booking.inventory_id) {
                updates.inventory_id = targetInventoryId || null;
            }

            if (adminNote.trim()) {
                const oldNotes = booking.notes || "";
                updates.notes = oldNotes + (oldNotes ? "\n\n" : "") + "Admin Update: " + adminNote;
            }

            console.log("Saving booking updates:", updates);

            // 3. Update Booking
            const { error: updateError } = await supabase
                .from("bookings")
                .update(updates)
                .eq("id", booking.id);

            if (updateError) {
                console.error("Supabase Update Error:", updateError);
                throw updateError;
            }

            // 4. Handle Inventory Status Changes
            // Scenario A: Swapping Car
            if (booking.inventory_id && targetInventoryId !== booking.inventory_id) {
                // Free old car
                await supabase.from("car_inventory").update({ status: 'available' }).eq('id', booking.inventory_id);
            }

            // Scenario B: Status Effects
            if (finalStatus === 'confirmed') {
                if (targetInventoryId && (targetInventoryId !== booking.inventory_id || booking.status !== 'confirmed')) {
                    // Rent new car
                    await supabase.from("car_inventory").update({ status: 'rented' }).eq('id', targetInventoryId);
                }
            } else if (finalStatus === 'pending' || finalStatus === 'cancelled' || finalStatus === 'completed') {
                // Free current car if it was rented
                if (targetInventoryId) {
                    await supabase.from("car_inventory").update({ status: 'available' }).eq('id', targetInventoryId);
                }
            }

            // 5. Log Action
            let actionType = 'UPDATE_STATUS';
            if (finalStatus === 'confirmed' && booking.status === 'pending') actionType = 'APPROVE_BOOKING';
            else if (finalStatus === 'cancelled') actionType = 'REJECT_BOOKING';
            else if (changes.length > 0) actionType = 'EDIT_BOOKING';

            // Find current inventory details for logging
            const assignedInv = inventoryItems.find(i => i.id === (targetInventoryId || booking.inventory_id));

            const logDetails = [
                `Customer: ${booking.customer_name}`,
                `Car: ${getCarName(booking.car)}`,
                ...(assignedInv ? [`Color: ${assignedInv.color}`, `Plate: ${assignedInv.plate_number}`] : []),
                ...(changes.length > 0 ? changes : [`Status: ${finalStatus}`])
            ].join(' | ');

            await logAction(
                actionType,
                booking.id,
                logDetails
            );

            onUpdate();
            onClose();

        } catch (error: any) {
            console.error("Error updating booking:", error);
            // alert(t("common.error") + ": " + (error.message || JSON.stringify(error))); 
        } finally {
            setUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-luxury-gray border border-gold/30 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                dir={dir}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-luxury-white">{t("admin.bookingDetails")}</h2>
                        <p className="text-luxury-white/60 text-sm mt-1">
                            Ref: #{String(booking.booking_number || "").padStart(4, '0')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-luxury-white/60 hover:text-luxury-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Main Content */}
                {!isEditMode ? (
                    <div className="space-y-6">
                        {/* Status */}
                        <div className="flex justify-between items-center">
                            <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusBadge(booking.status)}`}>
                                {getStatusLabel(booking.status)}
                            </span>
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="text-gold hover:text-gold-light text-sm underline"
                            >
                                {language === "ar" ? "تعديل الحجز" : "Edit Booking"}
                            </button>
                        </div>

                        {/* Customer Info */}
                        <div className="luxury-card bg-luxury-black/50">
                            <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                <User className="h-5 w-5" />
                                {t("admin.customerInfo")}
                            </h3>
                            <div className="space-y-1">
                                <p className="text-luxury-white font-medium">{booking.customer_name}</p>
                                <p className="text-luxury-white/80 text-sm" dir="ltr">{booking.customer_phone}</p>
                            </div>
                        </div>

                        {/* Car Info */}
                        <div className="luxury-card bg-luxury-black/50">
                            <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                <Car className="h-5 w-5" />
                                {t("admin.carInfo")}
                            </h3>
                            <p className="text-luxury-white font-medium">{getCarName(booking.car)}</p>
                            {booking.car?.plate_number && (
                                <p className="text-gold/80 text-sm mt-1 bg-black/20 px-2 py-1 rounded inline-block">
                                    {language === "ar" ? "رقم اللوحة:" : "Plate:"} {booking.car.plate_number}
                                </p>
                            )}
                        </div>

                        {/* Date & Location */}
                        <div className="luxury-card bg-luxury-black/50">
                            <h3 className="text-gold font-semibold mb-3 flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                {t("admin.bookingDetailsTitle")}
                            </h3>
                            <div className="space-y-2 text-sm text-luxury-white/80">
                                <div className="flex justify-between">
                                    <span>{t("admin.pickupDate")}:</span>
                                    <span className="text-luxury-white">{formatDate(booking.start_date)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t("admin.returnDate")}:</span>
                                    <span className="text-luxury-white">{formatDate(booking.end_date)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t("admin.pickupTime")}:</span>
                                    <span className="text-luxury-white">{booking.pickup_time || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t("admin.branchLocation")}:</span>
                                    <span className="text-luxury-white">{booking.branch || "-"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {booking.notes && (
                            <div className="luxury-card bg-luxury-black/50">
                                <h3 className="text-gold font-semibold mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    {t("admin.notes")}
                                </h3>
                                <p className="text-luxury-white/70 text-sm whitespace-pre-wrap">{booking.notes}</p>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className="pt-4 border-t border-gold/10 flex flex-col md:flex-row gap-3">
                            {booking.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            setStatus('confirmed');
                                            setIsEditMode(true);
                                        }}
                                        className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-3 rounded-xl hover:bg-green-500/30 font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Check className="h-5 w-5" />
                                        {language === "ar" ? "قبول وتعيين سيارة" : "Accept & Assign"}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm(t("admin.confirmReject"))) {
                                                handleSave('cancelled');
                                            }
                                        }}
                                        className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl hover:bg-red-500/30 font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <XCircle className="h-5 w-5" />
                                        {language === "ar" ? "رفض" : "Reject"}
                                    </button>
                                </>
                            )}
                            {booking.status === 'confirmed' && (
                                <>
                                    <Link
                                        href={`/admin/bookings/contract/${booking.id}`}
                                        target="_blank"
                                        className="bg-purple-500/20 text-purple-400 border border-purple-500/30 py-3 px-4 rounded-xl hover:bg-purple-500/30 font-bold flex items-center justify-center gap-2 transition-all"
                                        title={language === "ar" ? "طباعة العقد" : "Print Contract"}
                                    >
                                        <Printer className="h-5 w-5" />
                                    </Link>
                                    <button
                                        onClick={() => handleSave('completed')}
                                        className="flex-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 py-3 rounded-xl hover:bg-blue-500/30 font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Check className="h-5 w-5" />
                                        {language === "ar" ? "إكمال الحجز" : "Mark Complete"}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="flex-1 bg-gold/10 text-gold border border-gold/20 py-3 rounded-xl hover:bg-gold/20 font-bold transition-all"
                            >
                                {language === "ar" ? "تعديل التفاصيل" : "Edit Details"}
                            </button>
                        </div>
                    </div>
                ) : (
                    // EDIT FORM
                    <div className="space-y-4 animate-fadeIn">
                        {/* Status */}
                        <div>
                            <label className="block text-xs text-luxury-white/60 mb-1">{t("admin.updateStatus")}</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full bg-luxury-black border border-gold/20 rounded px-3 py-2 text-luxury-white focus:border-gold"
                            >
                                <option value="pending">{t("admin.statusPending")}</option>
                                <option value="confirmed">{t("admin.statusConfirmed")}</option>
                                <option value="completed">{t("admin.statusCompleted")}</option>
                                <option value="cancelled">{t("admin.statusCancelled")}</option>
                            </select>
                        </div>

                        {/* Inventory */}
                        <div>
                            <label className="block text-xs text-luxury-white/60 mb-1">
                                {language === "ar" ? "تخصيص السيارة (المخزون)" : "Assign Vehicle (Inventory)"}
                            </label>
                            <select
                                value={targetInventoryId}
                                onChange={(e) => setTargetInventoryId(e.target.value)}
                                className="w-full bg-luxury-black border border-gold/20 rounded px-3 py-2 text-luxury-white focus:border-gold"
                                dir="ltr"
                            >
                                <option value="">-- Select Inventory --</option>
                                {inventoryItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        [{item.plate_number}] {item.color} - {item.status}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{t("admin.pickupDate")}</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-luxury-black border border-gold/20 rounded px-2 py-2 text-luxury-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{t("admin.returnDate")}</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-luxury-black border border-gold/20 rounded px-2 py-2 text-luxury-white text-sm"
                                />
                            </div>
                        </div>

                        {/* Branch & Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{t("admin.pickupTime")}</label>
                                <input
                                    type="time"
                                    value={pickupTime}
                                    onChange={(e) => setPickupTime(e.target.value)}
                                    className="w-full bg-luxury-black border border-gold/20 rounded px-2 py-2 text-luxury-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{t("admin.branchLocation")}</label>
                                <input
                                    type="text"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full bg-luxury-black border border-gold/20 rounded px-2 py-2 text-luxury-white text-sm"
                                />
                            </div>
                        </div>

                        {/* National ID & Price */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{language === "ar" ? "رقم الهوية / الجواز" : "National ID / Passport"}</label>
                                <input
                                    type="text"
                                    value={nationalId}
                                    onChange={(e) => setNationalId(e.target.value)}
                                    className="w-full bg-luxury-black border border-gold/20 rounded px-3 py-2 text-luxury-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-luxury-white/60 mb-1">{language === "ar" ? "السعر الكلي (تحديث تلقائي)" : "Total Price (Auto-update)"}</label>
                                <div className="w-full bg-luxury-black/50 border border-gold/20 rounded px-3 py-2 text-gold font-bold text-sm flex items-center justify-between">
                                    <span>{formatCurrency(totalAmount)}</span>
                                    {discountPercentage > 0 && <span className="text-xs text-red-500">-{discountPercentage}%</span>}
                                </div>
                            </div>
                        </div>

                        {/* Discount */}
                        <div>
                            <label className="block text-xs text-luxury-white/60 mb-1">{language === "ar" ? "نسبة الخصم (%)" : "Discount Percentage (%)"}</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercentage}
                                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                                className="w-full bg-luxury-black border border-gold/20 rounded px-3 py-2 text-luxury-white focus:border-gold"
                                placeholder="0"
                            />
                        </div>

                        {/* Admin Note */}
                        <div>
                            <label className="block text-xs text-luxury-white/60 mb-1">{language === "ar" ? "ملاحظة التعديل" : "Edit Note"}</label>
                            <textarea
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                className="w-full bg-luxury-black border border-gold/20 rounded px-3 py-2 text-luxury-white text-sm resize-none h-16"
                                placeholder={language === "ar" ? "سبب التعديل..." : "Reason for edit..."}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => handleSave()}
                                disabled={updating}
                                className="flex-1 bg-gold text-luxury-black py-2 rounded font-bold hover:bg-gold-light disabled:opacity-50"
                            >
                                {updating ? "Saving..." : (language === "ar" ? "حفظ التغييرات" : "Save Changes")}
                            </button>
                            <button
                                onClick={() => setIsEditMode(false)}
                                disabled={updating}
                                className="px-4 bg-white/10 text-white rounded hover:bg-white/20"
                            >
                                {language === "ar" ? "إلغاء2" : "Cancel"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
