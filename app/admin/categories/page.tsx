"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Category } from "@/lib/types";
import {
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    Loader2,
    Folder
} from "lucide-react";

export default function AdminCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        nameAr: "",
        description: "",
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    async function fetchCategories() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("categories")
                .select("*")
                .order("name");

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!formData.name.trim()) {
            alert("Category name is required");
            return;
        }

        try {
            setSaving(true);

            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from("categories")
                    .update({
                        name: formData.name,
                        name_ar: formData.nameAr || null,
                        description: formData.description || null,
                    })
                    .eq("id", editingId);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from("categories")
                    .insert({
                        name: formData.name,
                        name_ar: formData.nameAr || null,
                        description: formData.description || null,
                    });

                if (error) throw error;
            }

            await fetchCategories();
            resetForm();
        } catch (error) {
            console.error("Error saving category:", error);
            alert("Failed to save category.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this category?")) return;

        try {
            setDeleting(id);
            const { error } = await supabase
                .from("categories")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setCategories(categories.filter((c) => c.id !== id));
        } catch (error) {
            console.error("Error deleting category:", error);
            alert("Failed to delete category. It may have cars assigned to it.");
        } finally {
            setDeleting(null);
        }
    }

    function startEdit(category: Category) {
        setEditingId(category.id);
        setFormData({
            name: category.name,
            nameAr: category.name_ar || "",
            description: category.description || "",
        });
        setShowForm(true);
    }

    function resetForm() {
        setEditingId(null);
        setFormData({ name: "", nameAr: "", description: "" });
        setShowForm(false);
    }

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
                    <h1 className="text-2xl font-bold text-luxury-white">Categories</h1>
                    <p className="text-luxury-white/60 mt-1">
                        Organize your vehicles by type
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-gold flex items-center gap-2 w-fit"
                    >
                        <Plus className="h-5 w-5" />
                        Add Category
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="luxury-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-luxury-white">
                            {editingId ? "Edit Category" : "New Category"}
                        </h2>
                        <button
                            onClick={resetForm}
                            className="p-2 text-luxury-white/60 hover:text-luxury-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Name (English) *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="e.g. Luxury"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Name (Arabic)
                            </label>
                            <input
                                type="text"
                                value={formData.nameAr}
                                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="فاخرة"
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50 resize-none"
                            rows={2}
                            placeholder="Brief description of this category..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-gold flex items-center gap-2"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {editingId ? "Update" : "Save"}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 border border-gold/30 rounded-lg text-luxury-white hover:bg-gold/10"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            {categories.length === 0 ? (
                <div className="luxury-card text-center py-12">
                    <Folder className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                    <p className="text-luxury-white/60">No categories yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                        <div key={category.id} className="luxury-card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-luxury-white">
                                        {category.name}
                                    </h3>
                                    {category.name_ar && (
                                        <p className="text-gold text-sm font-arabic">{category.name_ar}</p>
                                    )}
                                    {category.description && (
                                        <p className="text-luxury-white/60 text-sm mt-2 line-clamp-2">
                                            {category.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => startEdit(category)}
                                        className="p-2 text-luxury-white/60 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        disabled={deleting === category.id}
                                        className="p-2 text-luxury-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {deleting === category.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
