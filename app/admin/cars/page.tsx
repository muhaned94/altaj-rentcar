"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl, deleteImage } from "@/lib/supabase";
import { Car } from "@/lib/types";
import { formatCurrency, getStatusBadge } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { applyBranchFilter } from "@/lib/auth-helpers";
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Loader2,
    Car as CarIcon,
    MoreVertical,
    Copy
} from "lucide-react";

export default function AdminCarsPage() {
    const { language } = useLanguage();
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [duplicating, setDuplicating] = useState<string | null>(null);

    useEffect(() => {
        fetchCars();
    }, []);

    async function fetchCars() {
        try {
            setLoading(true);
            let query = supabase
                .from("cars")
                .select("*, category:categories(name), car_branches!inner(branch_id)")
                .order("created_at", { ascending: false });

            // Apply branch RBAC filter
            query = await applyBranchFilter(query, 'car_branches.branch_id');

            const { data, error } = await query;

            if (error) throw error;
            setCars(data || []);
        } catch (error) {
            console.error("Error fetching cars:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(car: Car) {
        if (!confirm(`Are you sure you want to delete "${car.name}"?`)) return;

        try {
            setDeleting(car.id);

            // Delete images from storage
            for (const imagePath of car.images) {
                await deleteImage(imagePath);
            }

            // Delete car from database
            const { error } = await supabase
                .from("cars")
                .delete()
                .eq("id", car.id);

            if (error) throw error;

            setCars(cars.filter((c) => c.id !== car.id));
        } catch (error) {
            console.error("Error deleting car:", error);
            alert("Failed to delete car. Please try again.");
        } finally {
            setDeleting(null);
        }
    }

    async function handleDuplicate(car: Car) {
        try {
            setDuplicating(car.id);

            // 1. Fetch full details (including features which might be missing in list view if we adjusted select)
            const { data: fullCar, error: fetchError } = await supabase
                .from("cars")
                .select("*")
                .eq("id", car.id)
                .single();

            if (fetchError || !fullCar) throw fetchError;

            // 2. Prepare new car data
            // We append (Copy) to Name and Plate to indicate it's a clone
            const newCarData = {
                ...fullCar,
                id: undefined, // Let DB generate ID
                created_at: undefined,
                updated_at: undefined,
                name: `${fullCar.name} (Copy)`,
                plate_number: fullCar.plate_number ? `${fullCar.plate_number}-CPY` : null,
                status: 'available' // Reset status to available
            };

            // 3. Insert new car
            const { data: insertedCar, error: insertError } = await supabase
                .from("cars")
                .insert(newCarData)
                .select()
                .single();

            if (insertError) throw insertError;

            // 4. Duplicate Branch Association
            // We need to fetch the branches for the original car first
            const { data: carBranches } = await supabase
                .from("car_branches")
                .select("branch_id")
                .eq("car_id", car.id);

            if (carBranches && carBranches.length > 0) {
                const branchInserts = carBranches.map((cb: any) => ({
                    car_id: insertedCar.id,
                    branch_id: cb.branch_id
                }));
                await supabase.from("car_branches").insert(branchInserts);
            }

            // 5. Refresh List
            fetchCars(); // Simpler than optimistic update here
            alert("Car duplicated successfully!");

        } catch (error) {
            console.error("Error duplicating car:", error);
            alert("Failed to duplicate car.");
        } finally {
            setDuplicating(null);
        }
    }

    const filteredCars = cars.filter((car) =>
        car.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        car.model.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white">
                        {language === "ar" ? "إدارة السيارات" : "Manage Cars"}
                    </h1>
                    <p className="text-luxury-white/60 mt-1">
                        {language === "ar"
                            ? `${cars.length} سيارة في أسطولك`
                            : `${cars.length} vehicles in your fleet`}
                    </p>
                </div>
                <Link href="/admin/cars/new" className="btn-gold flex items-center gap-2 w-fit">
                    <Plus className="h-5 w-5" />
                    {language === "ar" ? "إضافة سيارة جديدة" : "Add New Car"}
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gold" />
                <input
                    type="text"
                    placeholder={language === "ar" ? "بحث عن سيارة..." : "Search cars..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                />
            </div>

            {/* Cars List */}
            {filteredCars.length === 0 ? (
                <div className="luxury-card text-center py-12">
                    <CarIcon className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                    <p className="text-luxury-white/60">
                        {searchQuery
                            ? (language === "ar" ? "لا توجد نتائج بحث." : "No cars match your search.")
                            : (language === "ar" ? "لا توجد سيارات. أضف سيارتك الأولى!" : "No cars yet. Add your first vehicle!")}
                    </p>
                    {!searchQuery && (
                        <Link href="/admin/cars/new" className="btn-gold inline-flex items-center gap-2 mt-4">
                            <Plus className="h-5 w-5" />
                            {language === "ar" ? "إضافة سيارة جديدة" : "Add New Car"}
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block luxury-card overflow-hidden p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right" dir={language === "ar" ? "rtl" : "ltr"}>
                                <thead>
                                    <tr className="border-b border-gold/20 bg-luxury-gray/50">
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "السيارة" : "Car"}</th>
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "اللوحة" : "Plate"}</th>
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "الفئة" : "Category"}</th>
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "السنة" : "Year"}</th>
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "السعر اليومي" : "Daily Rate"}</th>
                                        <th className="text-left text-luxury-white/60 text-sm font-medium p-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                                        <th className="text-right text-luxury-white/60 text-sm font-medium p-4 text-end">{language === "ar" ? "إجراءات" : "Actions"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCars.map((car) => (
                                        <tr key={car.id} className="border-b border-gold/10 hover:bg-gold/5">
                                            <td className="p-4 text-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-16 h-12 rounded overflow-hidden bg-luxury-gray">
                                                        <Image
                                                            src={getImageUrl(car.images[0]) || "/placeholder-car.jpg"}
                                                            alt={car.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-luxury-white font-medium">{car.name}</p>
                                                        <p className="text-luxury-white/60 text-sm">{car.model}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-luxury-white/80">
                                                {car.plate_number ? (
                                                    <span className="bg-luxury-black border border-gold/20 px-2 py-1 rounded text-xs text-gold font-mono">
                                                        {car.plate_number}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="p-4 text-luxury-white/80">
                                                {car.category?.name || "—"}
                                            </td>
                                            <td className="p-4 text-luxury-white/80">{car.year}</td>
                                            <td className="p-4 text-gold font-medium">
                                                {formatCurrency(car.daily_rate, language)}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(car.status)}`}>
                                                    {car.status.charAt(0).toUpperCase() + car.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/admin/cars/${car.id}/edit`}
                                                        className="p-2 text-luxury-white/60 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDuplicate(car)}
                                                        disabled={duplicating === car.id}
                                                        className="p-2 text-luxury-white/60 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Duplicate Car"
                                                    >
                                                        {duplicating === car.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(car)}
                                                        disabled={deleting === car.id}
                                                        className="p-2 text-luxury-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {deleting === car.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-4">
                        {filteredCars.map((car) => (
                            <div key={car.id} className="luxury-card">
                                <div className="flex gap-4">
                                    <div className="relative w-24 h-20 rounded-lg overflow-hidden bg-luxury-gray flex-shrink-0">
                                        <Image
                                            src={getImageUrl(car.images[0]) || "/placeholder-car.jpg"}
                                            alt={car.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="text-luxury-white font-medium truncate">{car.name}</h3>
                                                <p className="text-luxury-white/60 text-sm">{car.model} • {car.year}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(car.status)}`}>
                                                {car.status.charAt(0).toUpperCase() + car.status.slice(1)}
                                            </span>
                                        </div>
                                        <p className="text-gold font-bold mt-2">{formatCurrency(car.daily_rate, language)}/day</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gold/20">
                                    <Link
                                        href={`/admin/cars/${car.id}/edit`}
                                        className="flex-1 py-2 text-center text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors"
                                    >
                                        {language === "ar" ? "تعديل" : "Edit"}
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(car)}
                                        disabled={deleting === car.id}
                                        className="flex-1 py-2 text-center text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                    >
                                        {deleting === car.id
                                            ? (language === "ar" ? "جاري الحذف..." : "Deleting...")
                                            : (language === "ar" ? "حذف" : "Delete")}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
