
"use client";

import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

interface SearchBarProps {
    onSearch?: (query: string) => void;
    onFilterChange?: (filters: SearchFilters) => void;
}

export interface SearchFilters {
    query: string;
    categoryId?: string;
    year?: number;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
}

interface Category {
    id: string;
    name: string;
    name_ar?: string;
}

export default function SearchBar({ onSearch, onFilterChange }: SearchBarProps) {
    const { t, dir, language } = useLanguage();
    const [query, setQuery] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({ query: "" });
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('*');
            if (data) setCategories(data);
        }
        fetchCategories();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSearch) {
            onSearch(query);
        }
        if (onFilterChange) {
            onFilterChange({ ...filters, query });
        }
    };

    const handleFilterChange = (key: keyof SearchFilters, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 15 }, (_, i) => currentYear + 1 - i);

    return (
        <div className="w-full" dir={dir}>
            {/* Search Input */}
            <form onSubmit={handleSearch} className="relative">
                <div className="relative flex items-center">
                    <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} h-5 w-5 text-gold`} />
                    <input
                        type="text"
                        placeholder={t("cars.search")}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            handleFilterChange("query", e.target.value);
                        }}
                        className={`w-full ${dir === 'rtl' ? 'pr-12 pl-14' : 'pl-12 pr-14'} py-3 sm:py-4 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 transition-colors`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} p-2 rounded-lg text-gold hover:bg-gold/10 transition-colors`}
                        aria-label="Toggle filters"
                    >
                        <SlidersHorizontal className={`h-5 w-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </form>

            {/* Advanced Filters - Collapsible */}
            {showFilters && (
                <div className="mt-4 p-4 glass-dark rounded-lg border border-gold/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Category Filter */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("booking.branch")}
                            </label>
                            <select
                                onChange={(e) => handleFilterChange("categoryId", e.target.value || undefined)}
                                className="w-full px-3 py-2 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                            >
                                <option value="">{t("cars.all")}</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Year Filter */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("cars.year")}
                            </label>
                            <select
                                onChange={(e) => handleFilterChange("year", Number(e.target.value) || undefined)}
                                className="w-full px-3 py-2 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                            >
                                <option value="">{t("cars.all")}</option>
                                {years.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        {/* Price Range */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("cars.priceRange")} | {filters.maxPrice ? formatCurrency(filters.maxPrice, language) : (dir === 'rtl' ? 'الكل' : 'Any')}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1000000"
                                step="10000"
                                onChange={(e) => handleFilterChange("maxPrice", Number(e.target.value) || undefined)}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
