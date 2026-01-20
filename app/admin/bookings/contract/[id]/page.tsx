"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Booking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";

interface BookingWithInventory extends Booking {
    inventory?: {
        plate_number: string;
        color: string;
    }
}

export default function ContractPage() {
    const { language } = useLanguage();
    const params = useParams();
    const bookingId = params.id as string;
    const [booking, setBooking] = useState<BookingWithInventory | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBooking();
    }, [bookingId]);

    async function fetchBooking() {
        try {
            const { data, error } = await supabase
                .from("bookings")
                .select("*, car:cars(name, name_ar, model, year, color, daily_rate, plate_number), inventory:car_inventory(plate_number, color)")
                .eq("id", bookingId)
                .single();

            if (error) throw error;
            setBooking(data);
        } catch (error) {
            console.error("Error fetching booking:", error);
        } finally {
            setLoading(false);
        }
    }

    function handlePrint() {
        window.print();
    }

    function calculateDays(): number {
        if (!booking) return 0;
        const start = new Date(booking.start_date);
        const end = new Date(booking.end_date);
        const diff = end.getTime() - start.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-gray-600">Booking not found</p>
            </div>
        );
    }

    const bookingRef = booking.booking_number
        ? String(booking.booking_number).padStart(4, '0')
        : booking.id.slice(0, 8).toUpperCase();

    return (
        <>
            {/* Print Controls - Hidden when printing */}
            <div className="print:hidden bg-gray-100 p-4 sticky top-0 z-10 flex items-center justify-between">
                <Link href="/admin/bookings" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-5 w-5" />
                    Back to Bookings
                </Link>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                    <Printer className="h-5 w-5" />
                    Print Contract
                </button>
            </div>

            {/* Contract Content */}
            <div className="max-w-[21cm] mx-auto bg-white min-h-screen print:p-0">
                {/* Page 1: Contract Details */}
                <div className="p-6 print:h-[29.7cm] print:relative relative">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
                        <div className="text-center w-full">
                            <div className="flex flex-col items-center justify-center mb-2">
                                <div className="border-2 border-black rounded-full p-2 mb-1">
                                    <div className="border border-black rounded-full p-1">
                                        <div className="text-black">
                                            {/* Logo Placeholder using Lucide Icon */}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="48"
                                                height="48"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h1 className="text-2xl font-extrabold text-black">شركة التاج لتأجير السيارات</h1>
                            <h2 className="text-lg font-bold text-black mb-1">Al-Taj Car Rental Company</h2>
                            <p className="text-black text-xs font-bold">
                                {booking.branch?.includes("Erbil") || booking.branch?.includes("أربيل") ? "Erbil Branch | فرع أربيل" :
                                    booking.branch?.includes("Basra") || booking.branch?.includes("البصرة") ? "Basra Branch | فرع البصرة" :
                                        booking.branch?.includes("Mansour") || booking.branch?.includes("المنصور") ? "Baghdad, Al-Mansour | بغداد - المنصور" :
                                            "Baghdad, Jadriya | بغداد - الجادرية"}
                            </p>
                            <p className="text-black text-xs font-bold mt-0.5">+964 770 000 0001</p>
                        </div>
                    </div>

                    {/* Contract Title */}
                    <div className="text-center mb-5">
                        <h3 className="text-xl font-extrabold text-black border-4 border-black inline-block px-8 py-1">
                            عقد إيجار سيارة
                        </h3>
                        <p className="text-base font-bold text-black mt-1">CAR RENTAL AGREEMENT</p>
                    </div>

                    {/* Contract Number & Date */}
                    <div className="flex justify-between mb-5 text-sm">
                        <div>
                            <span className="text-black font-bold">Contract No. / رقم العقد:</span>
                            <span className="font-extrabold text-black mr-2 ml-2">{bookingRef}</span>
                        </div>
                        <div>
                            <span className="text-black font-bold">Date / التاريخ:</span>
                            <span className="font-extrabold text-black mr-2 ml-2">{new Date().toLocaleDateString('en-GB')}</span>
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="mb-4">
                        <h4 className="text-base font-extrabold text-black border-b-2 border-black pb-1 mb-2">
                            معلومات المستأجر / Customer Information
                        </h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Full Name / الاسم:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{booking.customer_name}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Phone / الهاتف:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1" dir="ltr">{booking.customer_phone}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">National ID / البطاقة:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{booking.national_id || "________________"}</span>
                            </div>
                            {booking.customer_email && (
                                <div className="flex gap-2 items-baseline">
                                    <span className="text-black font-bold min-w-[120px]">Email / البريد:</span>
                                    <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{booking.customer_email}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Vehicle Information */}
                    <div className="mb-4">
                        <h4 className="text-base font-extrabold text-black border-b-2 border-black pb-1 mb-2">
                            معلومات السيارة / Vehicle Information
                        </h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Car Name / السيارة:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">
                                    {booking.car?.name} {booking.car?.name_ar ? `(${booking.car.name_ar})` : ""}
                                </span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Model / الموديل:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{booking.car?.model}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Year / السنة:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{booking.car?.year}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">
                                    {booking.inventory?.color || booking.car?.color || "-"}
                                </span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Plate No. / اللوحة:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">
                                    {booking.inventory?.plate_number || booking.car?.plate_number || "-"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Rental Period */}
                    <div className="mb-4">
                        <h4 className="text-base font-extrabold text-black border-b-2 border-black pb-1 mb-2">
                            فترة الإيجار / Rental Period
                        </h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Pickup / الاستلام:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{formatDate(booking.start_date)}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Return / الإرجاع:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{formatDate(booking.end_date)}</span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[110px]">Branch / الفرع:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">
                                    {booking.branch || "Baghdad"}
                                </span>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="text-black font-bold min-w-[120px]">Duration / المدة:</span>
                                <span className="font-bold text-black border-b border-dotted border-black flex-1 pb-1">{calculateDays()} days / أيام</span>
                            </div>
                        </div>
                    </div>

                    {/* Financial Details */}
                    <div className="mb-8">
                        <h4 className="text-lg font-extrabold text-black border-b-2 border-black pb-1 mb-3">
                            التفاصيل المالية / Financial Details
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg border-2 border-black">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between border-b border-black pb-2">
                                    <span className="text-black font-bold">Daily Rate / السعر اليومي</span>
                                    <span className="font-extrabold text-black text-lg">{formatCurrency(booking.car?.daily_rate || 0, language)}</span>
                                </div>
                                <div className="flex justify-between border-b border-black pb-2">
                                    <span className="text-black font-bold">Days / عدد الأيام</span>
                                    <span className="font-extrabold text-black text-lg">{calculateDays()}</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-2 flex justify-between items-center">
                                <span className="text-xl font-extrabold text-black">Total / الإجمالي</span>
                                <span className="text-2xl font-black text-black">{formatCurrency(booking.total_amount, language)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-12 mt-auto pt-12">
                        <div className="text-center">
                            <p className="text-black font-bold mb-16">توقيع المستأجر / Renter's Signature</p>
                            <div className="border-b-2 border-black mx-4"></div>
                            <p className="text-sm font-bold text-black mt-2">{booking.customer_name}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-black font-bold mb-16">توقيع المؤجر / Lessor's Signature</p>
                            <div className="border-b-2 border-black mx-4"></div>
                            <p className="text-sm font-bold text-black mt-2">Al-Taj Company</p>
                        </div>
                    </div>

                    {/* Footer for Page 1 */}
                    <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-400 print:block hidden">
                        <p>Page 1 of 2</p>
                    </div>
                </div>

                {/* Page 2: Terms & Conditions */}
                <div className="p-6 break-before-page print:h-[29.7cm] print:relative relative">
                    {/* Header Repeat (Small) */}
                    <div className="flex items-center justify-between border-b border-black pb-3 mb-6 text-[10px] font-bold text-black">
                        <span>Al-Taj Car Rental - Contract Terms</span>
                        <span>Contract No: {bookingRef}</span>
                    </div>

                    <h4 className="text-xl font-extrabold text-black border-b-2 border-black pb-2 mb-6">
                        الشروط والأحكام / Terms & Conditions
                    </h4>

                    <div className="grid grid-cols-1 gap-6 text-sm text-black leading-relaxed">
                        <div className="p-6 rounded-lg border-2 border-black bg-white">
                            <h5 className="font-extrabold text-black mb-3 text-base underline">باللغة العربية</h5>
                            <ol className="list-decimal list-inside space-y-2 font-bold">
                                <li>المستأجر مسؤول مسؤولية كاملة عن أي أضرار تلحق بالسيارة (حوادث، خدوش، سرقة) خلال فترة الإيجار ويتحمل تكاليف الإصلاح بالكامل بالإضافة إلى قيمة تعويض توقف السيارة عن العمل.</li>
                                <li>يجب إعادة السيارة بنفس الحالة التي استلمت بها، بما في ذلك نظافة السيارة ومستوى الوقود.</li>
                                <li>يمنع منعاً باتاً التدخين داخل السيارة، وتفرض غرامة مالية قدرها 50,000 د.ع في حال المخالفة.</li>
                                <li>يمنع السفر بالسيارة خارج حدود المحافظة المتفق عليها دون إذن خطي مسبق من الشركة.</li>
                                <li>في حال تأخر العميل عن موعد تسليم السيارة، تفرض غرامة تأخير قدرها 50,000 د.ع عن كل ساعة تأخير، ويحتسب يوم كامل بعد مرور 4 ساعات.</li>
                                <li>الشركة غير مسؤولة عن أي مقتنيات شخصية تترك داخل السيارة عند تسليمها.</li>
                                <li>يحق للشركة سحب السيارة في أي وقت في حال مخالفة الشروط المتفق عليها دون سابق إنذار ولا يحق للمستأجر المطالبة بأي تعويض.</li>
                            </ol>
                        </div>

                        <div className="p-6 rounded-lg border-2 border-black bg-white" dir="ltr">
                            <h5 className="font-extrabold text-black mb-3 text-base underline">In English</h5>
                            <ol className="list-decimal list-inside space-y-2 font-bold">
                                <li>The renter is fully responsible for any damages to the car (accidents, scratches, theft) during the rental period and bears all repair costs plus compensation for vehicle downtime.</li>
                                <li>The vehicle must be returned in the same condition it was received, including cleanliness and fuel level.</li>
                                <li>Smoking is strictly prohibited inside the vehicle. A fine of 50,000 IQD applies for violations.</li>
                                <li>Traveling outside the agreed governorate boundaries is prohibited without prior written permission from the company.</li>
                                <li>Late return penalty: 50,000 IQD per hour of delay. A full day charge applies after 4 hours.</li>
                                <li>The company is not responsible for any personal belongings left in the car upon return.</li>
                                <li>The company reserves the right to retrieve the vehicle at any time without prior notice if terms are violated, with no compensation due to the renter.</li>
                            </ol>
                        </div>
                    </div>

                    {/* Footer for Page 2 */}
                    <div className="absolute bottom-4 left-0 right-0 text-center text-xs font-bold text-black print:block hidden">
                        <p>Page 2 of 2</p>
                        <p className="mt-1">شركة التاج لتأجير السيارات | Al-Taj Car Rental Company</p>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background-color: white;
                    }
                    .break-before-page {
                        page-break-before: always;
                    }
                }
            `}</style>
        </>
    );
}
