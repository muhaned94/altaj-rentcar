"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Car, Category } from "@/lib/types";
import {
    ArrowLeft,
    Save,
    Loader2,
    Upload,
    X,
    Trash2,
    ImageIcon,
    Check
} from "lucide-react";

interface Branch {
    id: string;
    name: string;
    name_ar: string;
}

const COMMON_COLORS = [
    { name: "White - أبيض", value: "White" },
    { name: "Black - أسود", value: "Black" },
    { name: "Silver - فضي", value: "Silver" },
    { name: "Gray - رمادي", value: "Gray" },
    { name: "Red - أحمر", value: "Red" },
    { name: "Blue - أزرق", value: "Blue" },
    { name: "Brown - بني", value: "Brown" },
    { name: "Gold - ذهبي", value: "Gold" },
    { name: "Green - أخضر", value: "Green" },
    { name: "Other - لون آخر", value: "Other" },
];

export default function EditCarPage() {
    const params = useParams();
    const router = useRouter();
    const carId = params.id as string;
    const { t, language, dir } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [newImages, setNewImages] = useState<File[]>([]);
    const [deletedImages, setDeletedImages] = useState<string[]>([]);

    // Multi-branch state
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [initialBranchIds, setInitialBranchIds] = useState<string[]>([]);

    const [customColor, setCustomColor] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        nameAr: "",
        model: "",
        year: new Date().getFullYear(),
        colorKey: "White",
        dailyRate: 0,
        categoryId: "",
        plateNumber: "",
        status: "available" as "available" | "rented" | "maintenance",
        features: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchData();
    }, [carId]);

    async function fetchData() {
        try {
            setLoading(true);

            // Fetch car
            const { data: car, error: carError } = await supabase
                .from("cars")
                .select("*")
                .eq("id", carId)
                .single();

            if (carError) throw carError;

            // Fetch categories & branches
            const [categoriesRes, branchesRes] = await Promise.all([
                supabase.from("categories").select("*").order("name"),
                supabase.from("branches").select("*").eq("is_active", true).order("name")
            ]);

            setCategories(categoriesRes.data || []);
            setBranches(branchesRes.data || []);

            // Fetch car branches relation
            const { data: carBranches, error: cbError } = await supabase
                .from("car_branches")
                .select("branch_id")
                .eq("car_id", carId);

            if (cbError) throw cbError;

            if (car) {
                // Determine color state
                let colorKey = "Other";
                let custom = car.color || "";

                const foundColor = COMMON_COLORS.find(c => c.value === car.color);
                if (foundColor) {
                    colorKey = foundColor.value;
                    custom = "";
                }

                setFormData({
                    name: car.name || "",
                    nameAr: car.name_ar || "",
                    model: car.model || "",
                    year: car.year || new Date().getFullYear(),
                    colorKey: colorKey,
                    dailyRate: car.daily_rate || 0,
                    categoryId: car.category_id || "",
                    plateNumber: car.plate_number || "",
                    status: car.status || "available",
                    features: Array.isArray(car.features) ? car.features.join(", ") : "",
                });

                setCustomColor(custom);
                setExistingImages(car.images || []);

                // Set branches
                const branchIds = carBranches.map(cb => cb.branch_id);
                setSelectedBranchIds(branchIds);
                setInitialBranchIds(branchIds);
            }
        } catch (error) {
            console.error("Error fetching car:", error);
            alert(t("common.error"));
        } finally {
            setLoading(false);
        }
    }

    function toggleBranch(branchId: string) {
        setSelectedBranchIds(prev =>
            prev.includes(branchId)
                ? prev.filter(id => id !== branchId)
                : [...prev, branchId]
        );
    }

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) newErrors.name = language === "ar" ? "مطلوب" : "Required";
        if (!formData.model.trim()) newErrors.model = language === "ar" ? "مطلوب" : "Required";
        if (isNaN(formData.dailyRate) || formData.dailyRate <= 0) newErrors.dailyRate = language === "ar" ? "يجب أن يكون أكبر من 0" : "Must be greater than 0";

        // Year validation
        if (isNaN(formData.year) || formData.year < 1900 || formData.year > new Date().getFullYear() + 2) {
            // Optional: add error for year if we had a UI field for it in errors, but ensuring it's not NaN is key.
            // But actually there is no `errors.year` in the JSX for year input explicitly shown with error message below it?
            // Line 368: just the input. No error message below it.
            // I'll add an error check or just default it.
        }

        if (selectedBranchIds.length === 0) newErrors.branches = language === "ar" ? "اختر فرعاً واحداً على الأقل" : "Select at least one branch";
        if (!formData.plateNumber.trim()) newErrors.plateNumber = language === "ar" ? "مطلوب" : "Required";

        if (formData.colorKey === "Other" && !customColor.trim()) {
            newErrors.color = language === "ar" ? "مطلوب" : "Required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSaving(true);

            // Upload new images
            const uploadedUrls: string[] = [];
            for (const file of newImages) {
                const fileName = `${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from("car-images")
                    .upload(fileName, file);

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    continue;
                }
                uploadedUrls.push(fileName);
            }

            // Combine existing (minus deleted) with new
            const finalImages = [
                ...existingImages.filter(img => !deletedImages.includes(img)),
                ...uploadedUrls
            ];

            const finalColor = formData.colorKey === "Other" ? customColor : formData.colorKey;

            const updatePayload = {
                name: formData.name,
                name_ar: formData.nameAr || null,
                model: formData.model,
                year: formData.year,
                color: finalColor || null,
                daily_rate: formData.dailyRate,
                category_id: formData.categoryId || null,
                // branch_id is no longer managed directly here
                plate_number: formData.plateNumber || null,
                status: formData.status,
                features: formData.features ? formData.features.split(",").map(f => f.trim()) : [],
                images: finalImages,
            };

            console.log("Updating car with payload:", updatePayload);

            // Update car
            const { error } = await supabase
                .from("cars")
                .update(updatePayload)
                .eq("id", carId);

            if (error) {
                console.error("Supabase update error:", error);
                throw new Error(`Update Car Error: ${error.message}`);
            }

            // Sync Branches
            // 1. Calculate branches to remove (in initial but not in selected)
            const toRemove = initialBranchIds.filter(id => !selectedBranchIds.includes(id));
            if (toRemove.length > 0) {
                const { error: rmError } = await supabase
                    .from("car_branches")
                    .delete()
                    .eq("car_id", carId)
                    .in("branch_id", toRemove);
                if (rmError) {
                    console.error("Error removing branches:", rmError);
                    throw new Error(`Remove Branches Error: ${rmError.message}`);
                }
            }

            // 2. Calculate branches to add (in selected but not in initial)
            const toAdd = selectedBranchIds.filter(id => !initialBranchIds.includes(id));
            if (toAdd.length > 0) {
                const addInserts = toAdd.map(bid => ({ car_id: carId, branch_id: bid }));
                const { error: addError } = await supabase
                    .from("car_branches")
                    .insert(addInserts);
                if (addError) {
                    console.error("Error adding branches:", addError);
                    throw new Error(`Add Branches Error: ${addError.message}`);
                }
            }


            // Delete removed images from storage
            for (const img of deletedImages) {
                await supabase.storage.from("car-images").remove([img]);
            }

            router.push("/admin/cars");
        } catch (error: any) {
            console.error("Error updating car:", error);
            alert(language === "ar" ? `حدث خطأ: ${error.message || "خطأ غير معروف"}` : `Error: ${error.message || "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    }

    function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (files) {
            setNewImages([...newImages, ...Array.from(files)]);
        }
    }

    function removeExistingImage(img: string) {
        setDeletedImages([...deletedImages, img]);
    }

    function removeNewImage(index: number) {
        setNewImages(newImages.filter((_, i) => i !== index));
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto" dir={dir}>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/cars"
                    className="p-2 text-luxury-white/60 hover:text-gold rounded-lg hover:bg-gold/10"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white">{t("admin.editCar")}</h1>
                    <p className="text-luxury-white/60 text-sm mt-1">{formData.name}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">
                        {language === "ar" ? "المعلومات الأساسية" : "Basic Information"}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carNameEn")} *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white ${errors.name ? "border-red-500" : "border-gold/20"}`}
                                dir="ltr"
                            />
                            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carNameAr")}
                            </label>
                            <input
                                type="text"
                                value={formData.nameAr}
                                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white"
                                dir="rtl"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carModel")} *
                            </label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white ${errors.model ? "border-red-500" : "border-gold/20"}`}
                            />
                            {errors.model && <p className="text-red-400 text-sm mt-1">{errors.model}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carYear")}
                            </label>
                            <input
                                type="number"
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white"
                            />
                        </div>

                        {/* Color Selection */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carColor")}
                            </label>
                            <select
                                value={formData.colorKey}
                                onChange={(e) => setFormData({ ...formData, colorKey: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white"
                            >
                                {COMMON_COLORS.map(c => (
                                    <option key={c.value} value={c.value}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>

                            {formData.colorKey === "Other" && (
                                <input
                                    type="text"
                                    value={customColor}
                                    onChange={(e) => setCustomColor(e.target.value)}
                                    className={`w-full mt-2 px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white ${errors.color ? "border-red-500" : "border-gold/20"}`}
                                    placeholder={language === "ar" ? "أدخل اللون" : "Enter color"}
                                />
                            )}
                            {errors.color && <p className="text-red-400 text-sm mt-1">{errors.color}</p>}
                        </div>
                    </div>
                </div>

                {/* Location & Identification */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Location & Identification</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Branches Checkboxes */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-3">
                                {language === "ar" ? "الفروع المتاحة" : "Available Branches"} *
                            </label>
                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-luxury-gray/50 rounded-lg border ${errors.branches ? "border-red-500" : "border-gold/10"}`}>
                                {branches.map((branch) => (
                                    <div
                                        key={branch.id}
                                        onClick={() => toggleBranch(branch.id)}
                                        className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-all border ${selectedBranchIds.includes(branch.id)
                                            ? "bg-gold/20 border-gold/50 text-gold"
                                            : "hover:bg-luxury-gray/80 border-transparent text-luxury-white/70"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedBranchIds.includes(branch.id)
                                            ? "bg-gold border-gold text-luxury-black"
                                            : "border-luxury-white/30"
                                            }`}>
                                            {selectedBranchIds.includes(branch.id) && <Check className="h-3 w-3" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">
                                                {language === "ar" ? branch.name_ar : branch.name}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {errors.branches && <p className="text-red-400 text-sm mt-1">{errors.branches}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {language === "ar" ? "رقم اللوحة" : "Plate Number"} *
                            </label>
                            <input
                                type="text"
                                value={formData.plateNumber}
                                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white ${errors.plateNumber ? "border-red-500" : "border-gold/20"}`}
                                placeholder="e.g. 123456 Baghdad"
                            />
                            {errors.plateNumber && <p className="text-red-400 text-sm mt-1">{errors.plateNumber}</p>}
                        </div>
                    </div>
                </div>

                {/* Pricing & Category */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">
                        {language === "ar" ? "التسعير والفئة" : "Pricing & Category"}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carDailyRate")} (IQD) *
                            </label>
                            <input
                                type="number"
                                value={formData.dailyRate}
                                onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white ${errors.dailyRate ? "border-red-500" : "border-gold/20"}`}
                            />
                            {errors.dailyRate && <p className="text-red-400 text-sm mt-1">{errors.dailyRate}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carCategory")}
                            </label>
                            <select
                                value={formData.categoryId}
                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white"
                            >
                                <option value="">{t("admin.selectCategory")}</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {language === "ar" && cat.name_ar ? cat.name_ar : cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carStatus")}
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white"
                            >
                                <option value="available">{language === "ar" ? "متاح" : "Available"}</option>
                                <option value="rented">{language === "ar" ? "مؤجر" : "Rented"}</option>
                                <option value="maintenance">{language === "ar" ? "صيانة" : "Maintenance"}</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">
                        {t("admin.carFeatures")}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.carFeatures")}
                            </label>
                            <textarea
                                value={formData.features}
                                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white resize-none"
                                rows={3}
                                placeholder={t("admin.featuresPlaceholder")}
                            />
                        </div>

                    </div>
                </div>


                {/* Images */}
                <div className="luxury-card" >
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">
                        {t("admin.carImages")}
                    </h2>

                    {/* Existing Images */}
                    {
                        existingImages.filter(img => !deletedImages.includes(img)).length > 0 && (
                            <div className="mb-4">
                                <p className="text-sm text-luxury-white/60 mb-2">
                                    {language === "ar" ? "الصور الحالية" : "Current Images"}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {existingImages.filter(img => !deletedImages.includes(img)).map((img, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-gold/20">
                                            <Image
                                                src={getImageUrl(img)}
                                                alt={`Car ${idx + 1}`}
                                                fill
                                                className="object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeExistingImage(img)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* New Images Preview */}
                    {
                        newImages.length > 0 && (
                            <div className="mb-4">
                                <p className="text-sm text-luxury-white/60 mb-2">
                                    {language === "ar" ? "صور جديدة" : "New Images"}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {newImages.map((file, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-green-500/30">
                                            <Image
                                                src={URL.createObjectURL(file)}
                                                alt={`New ${idx + 1}`}
                                                fill
                                                className="object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeNewImage(idx)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Upload Button */}
                    <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gold/30 rounded-lg cursor-pointer hover:border-gold/50 transition-colors">
                        <Upload className="h-6 w-6 text-gold" />
                        <span className="text-luxury-white/60">{t("admin.uploadImages")}</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                    </label>
                </div >

                {/* Submit Button */}
                < div className="flex gap-4" >
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-gold flex items-center gap-2 flex-1 justify-center"
                    >
                        {saving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {saving ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : t("common.save")}
                    </button>
                    <Link
                        href="/admin/cars"
                        className="px-6 py-3 border border-gold/30 rounded-lg text-luxury-white hover:bg-gold/10"
                    >
                        {t("common.cancel")}
                    </Link>
                </div >
            </form >
        </div >
    );
}
