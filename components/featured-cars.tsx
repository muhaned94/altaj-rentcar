"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Car } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { ArrowRight, Loader2, Gauge, Users, Fuel } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function FeaturedCars() {
    const { t, language } = useLanguage();
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFeatured() {
            try {
                // Fetch featured cars, if none, fetch top 3 by price
                const { data, error } = await supabase
                    .from("cars")
                    .select("*")
                    .eq("is_featured", true)
                    .limit(3);

                if (data && data.length > 0) {
                    setCars(data);
                } else {
                    // Fallback to expensive cars if no featured set
                    const { data: fallback } = await supabase
                        .from("cars")
                        .select("*")
                        .order("daily_rate", { ascending: false })
                        .limit(3);
                    if (fallback) setCars(fallback);
                }
            } catch (error) {
                console.error("Error fetching featured cars:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchFeatured();
    }, []);

    if (loading) return (
        <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
        </div>
    );

    if (cars.length === 0) return null;

    return (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-luxury-black relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gold/5 blur-3xl rounded-full" />

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4">
                        <span className="text-luxury-white">
                            {language === "ar" ? "أسطولنا" : "Our Featured"}
                        </span>
                        <span className="text-gold ml-2">
                            {language === "ar" ? "المميز" : "Fleet"}
                        </span>
                    </h2>
                    <p className="text-luxury-white/60 max-w-2xl mx-auto">
                        {language === "ar"
                            ? "اكتشف مجموعة مختارة من أرقى السيارات الفاخرة المتاحة للإيجار"
                            : "Discover our hand-picked selection of the most exclusive vehicles available for booking."}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {cars.map((car) => (
                        <div key={car.id} className="group relative bg-luxury-gray rounded-2xl overflow-hidden border border-gold/10 hover:border-gold/50 transition-all duration-300 hover:shadow-2xl hover:shadow-gold/10">
                            {/* Image Placeholder */}
                            <div className="aspect-[16/9] relative overflow-hidden bg-black/50">
                                {car.images && car.images[0] ? (
                                    <img
                                        src={car.images[0]}
                                        alt={car.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-luxury-white/20">
                                        <p>{language === "ar" ? "لا توجد صورة" : "No Image"}</p>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-luxury-black/90 to-transparent" />

                                <div className="absolute bottom-4 left-4 right-4">
                                    <h3 className="text-xl font-bold text-luxury-white mb-1">
                                        {language === "ar" && car.name_ar ? car.name_ar : car.name}
                                    </h3>
                                    <p className="text-gold font-bold">
                                        {formatCurrency(car.daily_rate, language)}
                                        <span className="text-xs text-luxury-white/60 font-normal">
                                            {language === "ar" ? "/يوم" : "/day"}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="p-6">
                                <div className="grid grid-cols-3 gap-4 mb-6 text-xs text-luxury-white/60">
                                    <div className="flex flex-col items-center gap-2 bg-luxury-black/30 p-2 rounded-lg">
                                        <Gauge className="h-4 w-4 text-gold" />
                                        <span>{car.year}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 bg-luxury-black/30 p-2 rounded-lg">
                                        <Users className="h-4 w-4 text-gold" />
                                        <span>{language === "ar" ? "4 مقاعد" : "4 Seats"}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 bg-luxury-black/30 p-2 rounded-lg">
                                        <Fuel className="h-4 w-4 text-gold" />
                                        <span>{language === "ar" ? "بنزين" : "Petrol"}</span>
                                    </div>
                                </div>

                                <Link
                                    href={`/cars/${car.id}`}
                                    className="w-full py-3 bg-gold/10 hover:bg-gold text-gold hover:text-luxury-black rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {language === "ar" ? "احجز الآن" : "Book Now"}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-12">
                    <Link
                        href="/cars"
                        className="inline-flex items-center gap-2 text-luxury-white hover:text-gold transition-colors border-b border-transparent hover:border-gold pb-1"
                    >
                        {language === "ar" ? "عرض جميع السيارات" : "View All Cars"}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
