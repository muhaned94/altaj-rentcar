
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { Car } from "@/lib/types";
import { formatCurrency, getStatusBadge } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import {
    ArrowLeft,
    Calendar,
    Fuel,
    Users,
    Car as CarIcon,
    Check,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Phone
} from "lucide-react";

export default function CarDetailPage() {
    const { language, t, dir } = useLanguage();
    const params = useParams();
    const carId = params.id as string;

    const [car, setCar] = useState<Car | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    useEffect(() => {
        if (carId) {
            fetchCar();
        }
    }, [carId]);

    async function fetchCar() {
        try {
            setLoading(true);
            // Fetch car with branches
            const { data, error: fetchError } = await supabase
                .from("cars")
                .select("*, category:categories(*), car_branches(branches(id, name, name_ar))")
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

    const nextImage = () => {
        if (car && car.images.length > 1) {
            setActiveImageIndex((prev) => (prev + 1) % car.images.length);
        }
    };

    const prevImage = () => {
        if (car && car.images.length > 1) {
            setActiveImageIndex((prev) => (prev - 1 + car.images.length) % car.images.length);
        }
    };

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

    if (error || !car) {
        return (
            <div dir={dir}>
                <Navbar />
                <div className="min-h-screen bg-luxury-black flex flex-col items-center justify-center px-4">
                    <p className="text-red-400 text-lg mb-4">{error || (dir === 'rtl' ? "السيارة غير موجودة" : "Car not found")}</p>
                    <Link href="/cars" className="btn-gold">
                        {t("booking.backToFleet")}
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    const primaryImage = car.images[activeImageIndex] || "/placeholder-car.jpg";
    // Parse branches from the joined data
    const availableBranches = car.car_branches?.map((cb: any) => cb.branches) || [];

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Back Button */}
                    <Link
                        href="/cars"
                        className="inline-flex items-center gap-2 text-luxury-white/60 hover:text-gold transition-colors mb-6"
                    >
                        {dir === 'rtl' ? <ChevronRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                        {t("booking.backToFleet")}
                    </Link>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Image Gallery */}
                        <div className="space-y-4">
                            {/* Main Image */}
                            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-luxury-gray">
                                <Image
                                    src={getImageUrl(primaryImage)}
                                    alt={car.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />

                                {/* Navigation Arrows */}
                                {car.images.length > 1 && (
                                    <>
                                        <button
                                            onClick={prevImage}
                                            className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-gold/80 transition-colors`}
                                            aria-label="Previous image"
                                        >
                                            {dir === 'rtl' ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
                                        </button>
                                        <button
                                            onClick={nextImage}
                                            className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-gold/80 transition-colors`}
                                            aria-label="Next image"
                                        >
                                            {dir === 'rtl' ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                                        </button>
                                    </>
                                )}

                                {/* Status Badge */}
                                <div className={`absolute top-4 ${dir === 'rtl' ? 'left-4' : 'right-4'}`}>
                                    <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadge(car.status)}`}>
                                        {t(`cars.${car.status}`)}
                                    </span>
                                </div>
                            </div>

                            {/* Thumbnail Gallery */}
                            {car.images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {car.images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${idx === activeImageIndex ? "border-gold" : "border-transparent"
                                                }`}
                                        >
                                            <Image
                                                src={getImageUrl(img)}
                                                alt={`${car.name} - Image ${idx + 1}`}
                                                fill
                                                className="object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Car Details */}
                        <div className="space-y-6">
                            {/* Title & Category */}
                            <div>
                                {car.category && (
                                    <span className="text-gold text-sm font-medium">
                                        {language === 'ar' && car.category.name_ar ? car.category.name_ar : car.category.name}
                                    </span>
                                )}
                                <h1 className="text-3xl sm:text-4xl font-bold text-luxury-white mt-1">
                                    {car.name}
                                </h1>
                                {car.name_ar && (
                                    <p className="text-xl text-luxury-white/60 font-arabic mt-1">{car.name_ar}</p>
                                )}
                                <p className="text-luxury-white/60 mt-2">
                                    {car.model} • {car.year} • {car.color}
                                </p>
                            </div>

                            {/* Price */}
                            <div className="luxury-card">
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-bold text-gold">
                                        {formatCurrency(car.daily_rate, language)}
                                    </span>
                                    <span className="text-luxury-white/60 mb-1">{t("cars.perDay")}</span>
                                </div>
                                <p className="text-luxury-white/60 text-sm mt-2">
                                    {t("booking.payOnDeliveryText")}
                                </p>
                            </div>

                            {/* Specifications */}
                            <div className="luxury-card">
                                <h3 className="text-lg font-semibold text-luxury-white mb-4">{t("cars.specifications")}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-gold/10">
                                            <Calendar className="h-5 w-5 text-gold" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-luxury-white/60">{t("cars.year")}</p>
                                            <p className="text-luxury-white font-medium">{car.year}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-gold/10">
                                            <CarIcon className="h-5 w-5 text-gold" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-luxury-white/60">{t("cars.model")}</p>
                                            <p className="text-luxury-white font-medium">{car.model}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            {car.features && car.features.length > 0 && (
                                <div className="luxury-card">
                                    <h3 className="text-lg font-semibold text-luxury-white mb-4">{t("cars.features")}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {car.features.map((feature, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-gold flex-shrink-0" />
                                                <span className="text-luxury-white/80 text-sm">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available Branches */}
                            <div className="luxury-card border-gold/30 bg-gold/5">
                                <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    {t("booking.availableAt")}
                                </h3>
                                {availableBranches.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                        {availableBranches.map((branch: any) => (
                                            <div key={branch.id} className="flex items-center justify-between p-3 rounded-lg bg-luxury-black/30 border border-gold/10">
                                                <div className="flex flex-col">
                                                    {language === 'ar' && branch.name_ar ? (
                                                        <span className="text-luxury-white font-medium font-arabic">{branch.name_ar}</span>
                                                    ) : (
                                                        <span className="text-luxury-white font-medium">{branch.name}</span>
                                                    )}
                                                    {language === 'ar' && branch.name_ar && (
                                                        <span className="text-luxury-white/60 text-sm">{branch.name}</span>
                                                    )}
                                                </div>
                                                <div className="text-gold text-sm">
                                                    <a href="tel:+9647700000001" className="hover:underline flex items-center gap-1">
                                                        {t("booking.callToBook")}
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-luxury-white/60">{t("booking.pleaseContact")}</p>
                                )}
                                <div className="mt-4 pt-4 border-t border-gold/10">
                                    <Link
                                        href={`/book/${carId}`}
                                        className="btn-gold w-full flex items-center justify-center gap-2"
                                    >
                                        <Calendar className="h-5 w-5" />
                                        {t("cars.bookNow")}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
