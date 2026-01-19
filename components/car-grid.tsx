"use client";

import { Car } from "@/lib/types";
import CarCard from "./car-card";
import { useLanguage } from "@/lib/language-context";

interface CarGridProps {
    cars: Car[];
    emptyMessage?: string;
}

export default function CarGrid({
    cars,
    emptyMessage
}: CarGridProps) {
    const { t, dir } = useLanguage();
    const finalEmptyMessage = emptyMessage || t("cars.emptyMessage");

    if (!cars || cars.length === 0) {
        return (
            <div className="text-center py-16" dir={dir}>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 mb-4">
                    <p className="text-2xl">🚗</p>
                </div>
                <p className="text-luxury-white/60 text-lg">{finalEmptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" dir={dir}>
            {cars.map((car, index) => (
                <CarCard key={car.id} car={car} priority={index < 4} />
            ))}
        </div>
    );
}
