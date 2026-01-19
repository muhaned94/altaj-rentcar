
"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Fuel, Users, Car as CarIcon } from "lucide-react";
import { Car } from "@/lib/types";
import { formatCurrency, getStatusBadge } from "@/lib/utils";
import { getImageUrl } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";

interface CarCardProps {
    car: Car;
    priority?: boolean;
}

export default function CarCard({ car, priority = false }: CarCardProps) {
    const { language, t, dir } = useLanguage();
    const primaryImage = car.images[0] || "/placeholder-car.jpg";
    const imageUrl = getImageUrl(primaryImage);

    return (
        <Link href={`/cars/${car.id}`} className="group block" dir={dir}>
            <div className="luxury-card h-full flex flex-col overflow-hidden">
                {/* Image Container */}
                <div className="relative h-48 sm:h-56 overflow-hidden rounded-lg bg-luxury-gray mb-4">
                    <Image
                        src={imageUrl}
                        alt={car.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        priority={priority}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />

                    {/* Status Badge */}
                    <div className={`absolute top-3 ${dir === 'rtl' ? 'left-3' : 'right-3'}`}>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(car.status)}`}>
                            {t(`cars.${car.status}`)}
                        </span>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Car Info */}
                <div className="flex-1 flex flex-col">
                    {/* Name and Model */}
                    <div className="mb-3">
                        <h3 className="text-lg font-bold text-luxury-white group-hover:text-gold transition-colors line-clamp-1">
                            {car.name}
                        </h3>
                        {car.name_ar && (
                            <p className="text-sm text-luxury-white/60 font-arabic line-clamp-1">
                                {car.name_ar}
                            </p>
                        )}
                        <p className="text-sm text-luxury-white/60 mt-1">
                            {car.model} • {car.year}
                        </p>
                    </div>

                    {/* Features - Max 3 displayed */}
                    {car.features && car.features.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {car.features.slice(0, 3).map((feature, idx) => (
                                <span
                                    key={idx}
                                    className="text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30"
                                >
                                    {feature}
                                </span>
                            ))}
                            {car.features.length > 3 && (
                                <span className="text-xs px-2 py-1 rounded bg-luxury-white/5 text-luxury-white/60">
                                    +{car.features.length - 3} {dir === 'rtl' ? 'أخرى' : 'more'}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Specs Icons */}
                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-luxury-white/60">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gold" />
                            <span>{car.year}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CarIcon className="h-3.5 w-3.5 text-gold" />
                            <span>{car.color}</span>
                        </div>
                    </div>

                    {/* Price and CTA */}
                    <div className="mt-auto pt-4 border-t border-gold/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-gold">
                                    {formatCurrency(car.daily_rate, language)}
                                </div>
                                <div className="text-xs text-luxury-white/60">{t("cars.perDay")}</div>
                            </div>
                            <div className="btn-gold text-sm px-4 py-2 group-hover:shadow-xl group-hover:shadow-gold/30 transition-shadow">
                                {t("cars.viewDetails")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
