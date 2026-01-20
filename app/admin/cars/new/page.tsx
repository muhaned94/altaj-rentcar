"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, uploadImage } from "@/lib/supabase";
import { Category } from "@/lib/types";
import {
    Save,
    Loader2,
    Upload,
    X,
    ArrowLeft,
    Check,
    Plus,
    Trash2
} from "lucide-react";
import Link from "next/link";

interface Branch {
    id: string;
    name: string;
    name_ar: string;
}

const COMMON_COLORS = [
    { name: "White", nameAr: "أبيض", value: "White" },
    { name: "Black", nameAr: "أسود", value: "Black" },
    { name: "Silver", nameAr: "فضي", value: "Silver" },
    { name: "Gray", nameAr: "رمادي", value: "Gray" },
    { name: "Red", nameAr: "أحمر", value: "Red" },
    { name: "Blue", nameAr: "أزرق", value: "Blue" },
    { name: "Brown", nameAr: "بني", value: "Brown" },
    { name: "Gold", nameAr: "ذهبي", value: "Gold" },
    { name: "Green", nameAr: "أخضر", value: "Green" },
    { name: "Other", nameAr: "لون آخر", value: "Other" },
];

interface InventoryItem {
    plate_number: string;
    color: string;
    status: string;
}

export default function NewCarPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [images, setImages] = useState<{ file: File; preview: string }[]>([]);

    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [customColor, setCustomColor] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        nameAr: "",
        model: "",
        year: new Date().getFullYear(),
        colorKey: "White",
        dailyRate: "",
        categoryId: "",
        status: "available",
        features: "",
    });

    // Inventory State
    const [inventory, setInventory] = useState<InventoryItem[]>([
        { plate_number: "", color: "White", status: "available" }
    ]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchDependencies();
    }, []);

    async function fetchDependencies() {
        const [categoriesRes, branchesRes] = await Promise.all([
            supabase.from("categories").select("*").order("name"),
            supabase.from("branches").select("*").eq("is_active", true).order("name")
        ]);

        if (categoriesRes.data) setCategories(categoriesRes.data);
        if (branchesRes.data) setBranches(branchesRes.data);
    }

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files) return;

        const newImages = Array.from(files).map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setImages([...images, ...newImages]);
    }

    function removeImage(index: number) {
        const newImages = [...images];
        URL.revokeObjectURL(newImages[index].preview);
        newImages.splice(index, 1);
        setImages(newImages);
    }

    function toggleBranch(branchId: string) {
        setSelectedBranchIds(prev =>
            prev.includes(branchId)
                ? prev.filter(id => id !== branchId)
                : [...prev, branchId]
        );
    }

    // Inventory Helpers
    function addInventoryItem() {
        setInventory([...inventory, { plate_number: "", color: "White", status: "available" }]);
    }

    function removeInventoryItem(index: number) {
        const newInv = [...inventory];
        newInv.splice(index, 1);
        setInventory(newInv);
    }

    function updateInventoryItem(index: number, field: keyof InventoryItem, value: string) {
        const newInv = [...inventory];
        newInv[index] = { ...newInv[index], [field]: value };
        setInventory(newInv);
    }

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) newErrors.name = "Car name is required";
        if (!formData.model.trim()) newErrors.model = "Model is required";
        if (!formData.year) newErrors.year = "Year is required";
        if (!formData.dailyRate || parseFloat(formData.dailyRate) <= 0) {
            newErrors.dailyRate = "Valid daily rate is required";
        }
        if (selectedBranchIds.length === 0) newErrors.branches = "At least one branch is required";

        // Validate Inventory
        const validInventory = inventory.filter(i => i.plate_number.trim());
        if (validInventory.length === 0) {
            newErrors.inventory = "At least one vehicle unit (plate number) is required.";
        }

        if (formData.colorKey === "Other" && !customColor.trim()) {
            newErrors.color = "Custom color is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);

            // Upload images
            const uploadedPaths: string[] = [];
            if (images.length > 0) {
                setUploading(true);
                for (const img of images) {
                    const path = await uploadImage(img.file);
                    if (path) uploadedPaths.push(path);
                }
                setUploading(false);
            }

            // Parse features
            const features = formData.features
                .split(",")
                .map((f) => f.trim())
                .filter((f) => f.length > 0);

            // Determine final color (for the model default)
            const finalColor = formData.colorKey === "Other" ? customColor : formData.colorKey;

            // Insert car
            const { data: newCar, error } = await supabase.from("cars").insert({
                name: formData.name,
                name_ar: formData.nameAr || null,
                model: formData.model,
                year: formData.year,
                color: finalColor,
                daily_rate: parseFloat(formData.dailyRate),
                category_id: formData.categoryId || null,
                status: formData.status,
                features,
                images: uploadedPaths,
            }).select().single();

            if (error) throw error;

            // Insert car_branches
            if (newCar && selectedBranchIds.length > 0) {
                const branchInserts = selectedBranchIds.map(branchId => ({
                    car_id: newCar.id,
                    branch_id: branchId
                }));

                const { error: branchError } = await supabase
                    .from("car_branches")
                    .insert(branchInserts);

                if (branchError) throw branchError;
            }

            // Insert Inventory
            const validInventory = inventory.filter(item => item.plate_number.trim());
            if (newCar && validInventory.length > 0) {
                const inventoryInserts = validInventory.map(item => ({
                    car_id: newCar.id,
                    plate_number: item.plate_number,
                    color: item.color,
                    status: item.status
                }));

                const { error: invError } = await supabase
                    .from("car_inventory")
                    .insert(inventoryInserts);

                if (invError) {
                    console.error("Error inserting inventory:", invError);
                    // Verify if we should warn the user.
                }
            }

            router.push("/admin/cars");
        } catch (error) {
            console.error("Error creating car:", error);
            alert("Failed to create car. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Link
                href="/admin/cars"
                className="inline-flex items-center gap-2 text-luxury-white/60 hover:text-gold transition-colors mb-6"
            >
                <ArrowLeft className="h-5 w-5" />
                Back to Cars
            </Link>

            <h1 className="text-2xl font-bold text-luxury-white mb-6">Add New Car</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Basic Information</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Car Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${errors.name ? "border-red-500" : "border-gold/20"
                                    }`}
                                placeholder="e.g. Mercedes S-Class"
                            />
                            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Arabic Name
                            </label>
                            <input
                                type="text"
                                value={formData.nameAr}
                                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="الإسم بالعربية"
                                dir="rtl"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Model *
                            </label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${errors.model ? "border-red-500" : "border-gold/20"
                                    }`}
                                placeholder="e.g. W223"
                            />
                            {errors.model && <p className="text-red-400 text-sm mt-1">{errors.model}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Year *
                            </label>
                            <input
                                type="number"
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${errors.year ? "border-red-500" : "border-gold/20"
                                    }`}
                                min="1990"
                                max={new Date().getFullYear() + 1}
                            />
                            {errors.year && <p className="text-red-400 text-sm mt-1">{errors.year}</p>}
                        </div>

                        {/* Color Selection */}
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Default Color
                            </label>
                            <select
                                value={formData.colorKey}
                                onChange={(e) => setFormData({ ...formData, colorKey: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                            >
                                {COMMON_COLORS.map(c => (
                                    <option key={c.value} value={c.value}>{c.name} - {c.nameAr}</option>
                                ))}
                            </select>

                            {formData.colorKey === "Other" && (
                                <input
                                    type="text"
                                    value={customColor}
                                    onChange={(e) => setCustomColor(e.target.value)}
                                    className={`w-full mt-2 px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${errors.color ? "border-red-500" : "border-gold/20"}`}
                                    placeholder="Enter custom color"
                                />
                            )}
                            {errors.color && <p className="text-red-400 text-sm mt-1">{errors.color}</p>}
                        </div>
                    </div>
                </div>

                {/* Fleet Inventory Management */}
                <div className="luxury-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-luxury-white">Fleet Inventory (Units)</h2>
                        <button
                            type="button"
                            onClick={addInventoryItem}
                            className="flex items-center gap-2 text-sm text-gold hover:text-gold-light"
                        >
                            <Plus className="h-4 w-4" /> Add Unit
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-luxury-white">
                            <thead className="text-luxury-white/60 uppercase bg-luxury-black/30">
                                <tr>
                                    <th className="px-4 py-3">Plate Number *</th>
                                    <th className="px-4 py-3">Color</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gold/10">
                                {inventory.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={item.plate_number}
                                                onChange={(e) => updateInventoryItem(idx, "plate_number", e.target.value)}
                                                className="w-full bg-transparent border border-gold/20 rounded px-2 py-1 text-luxury-white focus:border-gold/50 outline-none"
                                                placeholder="Plate #"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={COMMON_COLORS.some(c => c.value === item.color) ? item.color : "Other"}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    updateInventoryItem(idx, "color", val === "Other" ? "White" : val);
                                                }}
                                                className="bg-transparent border border-gold/20 rounded px-2 py-1 text-luxury-white focus:border-gold/50 outline-none"
                                            >
                                                {COMMON_COLORS.map(c => (
                                                    <option key={c.value} value={c.value} className="bg-luxury-gray">{c.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={item.status}
                                                onChange={(e) => updateInventoryItem(idx, "status", e.target.value)}
                                                className="bg-transparent border border-gold/20 rounded px-2 py-1 text-luxury-white focus:border-gold/50 outline-none"
                                            >
                                                <option value="available" className="bg-luxury-gray">Available</option>
                                                <option value="rented" className="bg-luxury-gray">Rented</option>
                                                <option value="maintenance" className="bg-luxury-gray">Maintenance</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => removeInventoryItem(idx)}
                                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {inventory.length === 0 && (
                        <p className="text-center py-4 text-luxury-white/40 text-sm">No inventory units added.</p>
                    )}
                    {errors.inventory && <p className="text-red-400 text-sm mt-2">{errors.inventory}</p>}
                </div>

                {/* Location & Identification */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Availability</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Branches Checkboxes */}
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-luxury-white/80 mb-3">
                                Available Branches *
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
                                            <p className="font-semibold text-sm">{branch.name_ar}</p>
                                            <p className="text-xs opacity-70">{branch.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {errors.branches && <p className="text-red-400 text-sm mt-1">{errors.branches}</p>}
                        </div>
                    </div>
                </div>

                {/* Pricing & Status */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Pricing & Other</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Daily Rate (SAR) *
                            </label>
                            <input
                                type="number"
                                value={formData.dailyRate}
                                onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                                className={`w-full px-4 py-3 bg-luxury-gray border rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 ${errors.dailyRate ? "border-red-500" : "border-gold/20"
                                    }`}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                            {errors.dailyRate && <p className="text-red-400 text-sm mt-1">{errors.dailyRate}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Category
                            </label>
                            <select
                                value={formData.categoryId}
                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                            >
                                <option value="">Select Category</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Model Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                            >
                                <option value="available">Available</option>
                                <option value="rented">Rented</option>
                                <option value="maintenance">Maintenance</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Features</h2>
                    <textarea
                        value={formData.features}
                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                        className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 resize-none"
                        rows={3}
                        placeholder="Enter features separated by commas (e.g. Leather Seats, Sunroof, GPS Navigation)"
                    />
                </div>

                {/* Images */}
                <div className="luxury-card">
                    <h2 className="text-lg font-semibold text-luxury-white mb-4">Images</h2>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gold/30 rounded-lg p-8 cursor-pointer hover:bg-gold/5 transition-colors">
                        <Upload className="h-10 w-10 text-gold mb-3" />
                        <span className="text-luxury-white/80 text-center">
                            Click to upload images
                        </span>
                        <span className="text-luxury-white/60 text-sm mt-1">
                            PNG, JPG, WEBP up to 5MB
                        </span>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                        />
                    </label>

                    {images.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-4">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-luxury-gray">
                                    <img
                                        src={img.preview}
                                        alt={`Preview ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-gold w-full text-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            {uploading ? "Uploading Images..." : "Saving..."}
                        </>
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            Save Car
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
