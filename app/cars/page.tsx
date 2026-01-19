
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Car } from "@/lib/types";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import SearchBar, { SearchFilters } from "@/components/search-bar";
import CarGrid from "@/components/car-grid";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function CarsPage() {
    const { t, dir } = useLanguage();
    const [cars, setCars] = useState<Car[]>([]);
    const [filteredCars, setFilteredCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchCars();
    }, []);

    async function fetchCars() {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from("cars")
                .select("*, category:categories(*)")
                .order("created_at", { ascending: false });

            if (fetchError) throw fetchError;

            setCars(data || []);
            setFilteredCars(data || []);
        } catch (err: any) {
            console.error("Error fetching cars:", err);
            setError(err.message || (dir === 'rtl' ? "فشل تحميل السيارات" : "Failed to load cars"));
        } finally {
            setLoading(false);
        }
    }

    function handleFilterChange(filters: SearchFilters) {
        let filtered = [...cars];

        // Search query
        if (filters.query) {
            const query = filters.query.toLowerCase();
            filtered = filtered.filter(
                (car) =>
                    car.name.toLowerCase().includes(query) ||
                    car.model.toLowerCase().includes(query) ||
                    car.color.toLowerCase().includes(query) ||
                    (car.name_ar && car.name_ar.includes(query))
            );
        }

        // Category Filter
        if (filters.categoryId) {
            filtered = filtered.filter((car) => car.category_id === filters.categoryId);
        }

        // Year Filter
        if (filters.year) {
            filtered = filtered.filter((car) => car.year === filters.year);
        }

        // Price range
        if (filters.minPrice !== undefined) {
            filtered = filtered.filter((car) => car.daily_rate >= filters.minPrice!);
        }
        if (filters.maxPrice !== undefined) {
            filtered = filtered.filter((car) => car.daily_rate <= filters.maxPrice!);
        }

        // Status
        if (filters.status) {
            filtered = filtered.filter((car) => car.status === filters.status);
        }

        setFilteredCars(filtered);
    }

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Page Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                            <span className="text-gold-gradient">{t("cars.heroTitle")}</span>
                        </h1>
                        <p className="text-luxury-white/70 text-lg max-w-2xl mx-auto">
                            {t("cars.heroSubtitle")}
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-8">
                        <SearchBar onFilterChange={handleFilterChange} />
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex justify-center items-center py-16">
                            <Loader2 className="h-12 w-12 text-gold animate-spin" />
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="text-center py-16">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button
                                onClick={fetchCars}
                                className="btn-gold"
                            >
                                {t("cars.tryAgain")}
                            </button>
                        </div>
                    )}

                    {/* Cars Grid */}
                    {!loading && !error && (
                        <>
                            <div className="mb-6 text-luxury-white/60">
                                {t("cars.showingCount")
                                    .replace("{count}", filteredCars.length.toString())
                                    .replace("{total}", cars.length.toString())}
                            </div>
                            <CarGrid
                                cars={filteredCars}
                                emptyMessage={t("cars.emptyMessage")}
                            />
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
