"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import {
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    Loader2,
    MapPin,
    Phone,
    Building
} from "lucide-react";

interface Branch {
    id: string;
    name: string;
    name_ar: string;
    address?: string;
    address_ar?: string;
    phone?: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminBranchesPage() {
    const { t, language, dir } = useLanguage();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        nameAr: "",
        address: "",
        addressAr: "",
        phone: "",
        isActive: true,
    });

    useEffect(() => {
        fetchBranches();
    }, []);

    async function fetchBranches() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("branches")
                .select("*")
                .order("name");

            if (error) throw error;
            setBranches(data || []);
        } catch (error) {
            console.error("Error fetching branches:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!formData.name.trim() || !formData.nameAr.trim()) {
            alert(t("common.required"));
            return;
        }

        try {
            setSaving(true);

            const branchData = {
                name: formData.name,
                name_ar: formData.nameAr,
                address: formData.address || null,
                address_ar: formData.addressAr || null,
                phone: formData.phone || null,
                is_active: formData.isActive,
            };

            if (editingId) {
                const { error } = await supabase
                    .from("branches")
                    .update(branchData)
                    .eq("id", editingId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("branches")
                    .insert(branchData);

                if (error) throw error;
            }

            await fetchBranches();
            resetForm();
        } catch (error) {
            console.error("Error saving branch:", error);
            alert(t("common.error"));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm(t("admin.confirmDelete"))) return;

        try {
            setDeleting(id);
            const { error } = await supabase
                .from("branches")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setBranches(branches.filter((b) => b.id !== id));
        } catch (error) {
            console.error("Error deleting branch:", error);
            alert(t("common.error"));
        } finally {
            setDeleting(null);
        }
    }

    async function toggleActive(branch: Branch) {
        try {
            const { error } = await supabase
                .from("branches")
                .update({ is_active: !branch.is_active })
                .eq("id", branch.id);

            if (error) throw error;
            setBranches(branches.map((b) =>
                b.id === branch.id ? { ...b, is_active: !branch.is_active } : b
            ));
        } catch (error) {
            console.error("Error toggling branch:", error);
        }
    }

    function startEdit(branch: Branch) {
        setEditingId(branch.id);
        setFormData({
            name: branch.name,
            nameAr: branch.name_ar,
            address: branch.address || "",
            addressAr: branch.address_ar || "",
            phone: branch.phone || "",
            isActive: branch.is_active,
        });
        setShowForm(true);
    }

    function resetForm() {
        setEditingId(null);
        setFormData({
            name: "",
            nameAr: "",
            address: "",
            addressAr: "",
            phone: "",
            isActive: true,
        });
        setShowForm(false);
    }

    const getBranchName = (branch: Branch) => {
        return language === "ar" ? branch.name_ar : branch.name;
    };

    const getBranchAddress = (branch: Branch) => {
        if (language === "ar" && branch.address_ar) return branch.address_ar;
        return branch.address;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white">{t("admin.manageBranches")}</h1>
                    <p className="text-luxury-white/60 mt-1">
                        {t("admin.branchesSubtitle")}
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-gold flex items-center gap-2 w-fit"
                    >
                        <Plus className="h-5 w-5" />
                        {t("admin.addBranch")}
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="luxury-card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-luxury-white">
                            {editingId ? t("admin.editBranch") : t("admin.newBranch")}
                        </h2>
                        <button
                            onClick={resetForm}
                            className="p-2 text-luxury-white/60 hover:text-luxury-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.branchNameEn")} *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="e.g. Baghdad - Jadriya"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.branchNameAr")} *
                            </label>
                            <input
                                type="text"
                                value={formData.nameAr}
                                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="بغداد - الجادرية"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.branchAddressEn")}
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="Full address in English"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.branchAddressAr")}
                            </label>
                            <input
                                type="text"
                                value={formData.addressAr}
                                onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="العنوان بالعربي"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                {t("admin.branchPhone")}
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:outline-none focus:border-gold/50"
                                placeholder="+964 770 000 0000"
                                dir="ltr"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="block text-sm font-medium text-luxury-white/80">
                                {t("admin.branchActive")}
                            </label>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                className={`w-12 h-6 rounded-full transition-colors ${formData.isActive ? "bg-green-500" : "bg-gray-600"
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${formData.isActive ? "translate-x-6" : "translate-x-0.5"
                                    }`} />
                            </button>
                        </div>
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
                            {editingId ? t("common.update") : t("common.save")}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 border border-gold/30 rounded-lg text-luxury-white hover:bg-gold/10"
                        >
                            {t("common.cancel")}
                        </button>
                    </div>
                </div>
            )}

            {/* Branches List */}
            {branches.length === 0 ? (
                <div className="luxury-card text-center py-12">
                    <Building className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                    <p className="text-luxury-white/60">{t("admin.noBranchesYet")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map((branch) => (
                        <div key={branch.id} className={`luxury-card ${!branch.is_active ? "opacity-60" : ""}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-gold" />
                                        <h3 className="text-lg font-semibold text-luxury-white">{getBranchName(branch)}</h3>
                                    </div>
                                    <p className="text-gold/80 text-sm mt-1">
                                        {language === "ar" ? branch.name : branch.name_ar}
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleActive(branch)}
                                    className={`px-2 py-1 rounded-full text-xs font-medium border ${branch.is_active
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                                        }`}
                                >
                                    {branch.is_active ? t("common.active") : t("common.inactive")}
                                </button>
                            </div>

                            {getBranchAddress(branch) && (
                                <p className="text-luxury-white/60 text-sm mb-2">{getBranchAddress(branch)}</p>
                            )}

                            {branch.phone && (
                                <p className="text-luxury-white/80 text-sm flex items-center gap-2 mb-3" dir="ltr">
                                    <Phone className="h-4 w-4 text-gold" />
                                    {branch.phone}
                                </p>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-gold/20">
                                <button
                                    onClick={() => startEdit(branch)}
                                    className="flex-1 py-2 text-center text-gold border border-gold/30 rounded-lg hover:bg-gold/10 transition-colors"
                                >
                                    <Pencil className="h-4 w-4 inline mx-1" />
                                    {t("common.edit")}
                                </button>
                                <button
                                    onClick={() => handleDelete(branch.id)}
                                    disabled={deleting === branch.id}
                                    className="flex-1 py-2 text-center text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                >
                                    {deleting === branch.id ? (
                                        <Loader2 className="h-4 w-4 inline animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 inline mx-1" />
                                            {t("common.delete")}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
