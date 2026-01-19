"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { Employee, UserRole, Branch } from "@/lib/types";
import {
    Plus,
    Pencil,
    Shield,
    X,
    Loader2,
    Users,
    Mail,
    Lock,
    CheckCircle2,
    XCircle,
    Trash2
} from "lucide-react";

export default function AdminUsersPage() {
    const { t, language, dir } = useLanguage();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        fullName: "",
        role: "staff" as UserRole,
        isActive: true,
        selectedBranches: [] as string[]
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            const [empRes, branchRes] = await Promise.all([
                supabase.from("employees").select("*, employee_branches(branch_id)").order("created_at"),
                supabase.from("branches").select("*").eq("is_active", true).order("name")
            ]);

            if (empRes.error) throw empRes.error;
            if (branchRes.error) throw branchRes.error;

            setEmployees(empRes.data || []);
            setBranches(branchRes.data || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!formData.fullName.trim() || !formData.email.trim() || (!editingId && !formData.password.trim())) {
            alert(t("common.required"));
            return;
        }

        try {
            setSaving(true);

            // Get current session for API calls
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            let userId = editingId;

            // 1. Handle Auth Account
            if (!editingId) {
                // Create user via API (doesn't auto-login the new user)
                const response = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        fullName: formData.fullName,
                        role: formData.role,
                        isActive: formData.isActive
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to create user');
                }

                userId = result.userId;
            } else {
                // 2. Update Employee Profile (Only for existing users)
                const employeeData = {
                    full_name: formData.fullName,
                    role: formData.role,
                    is_active: formData.isActive,
                    updated_at: new Date().toISOString()
                };

                const { error: profileError } = await supabase
                    .from("employees")
                    .update(employeeData)
                    .eq('id', userId);

                if (profileError) throw profileError;
            }

            // 3. Update Branch Assignments via API (bypasses RLS)
            if (formData.role !== 'super_admin') {
                const response = await fetch('/api/admin/employee-branches', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        employeeId: userId,
                        branchIds: formData.selectedBranches,
                        clearExisting: true
                    })
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || 'Failed to update branch assignments');
                }
            }

            await fetchData();
            resetForm();
        } catch (error: any) {
            console.error("Error saving user:", error);
            alert(error.message || t("common.error"));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (id === user?.id) {
            alert("You cannot delete your own account");
            return;
        }

        if (!confirm(t("admin.confirmDelete"))) return;

        try {
            setSaving(true);

            // Get the current session for authorization
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            // Call the API route to delete from both employees and auth.users
            const response = await fetch('/api/admin/delete-user', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ userId: id })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete user');
            }

            await fetchData();
        } catch (error: any) {
            console.error("Error deleting user:", error);
            alert(error.message || t("common.error"));
        } finally {
            setSaving(false);
        }
    }


    function startEdit(emp: Employee) {
        setEditingId(emp.id);
        setFormData({
            email: emp.email || "",
            password: "",
            fullName: emp.full_name,
            role: emp.role,
            isActive: emp.is_active,
            selectedBranches: emp.employee_branches?.map(eb => eb.branch_id) || []
        });
        setShowForm(true);
    }

    function resetForm() {
        setEditingId(null);
        setFormData({
            email: "",
            password: "",
            fullName: "",
            role: "staff",
            isActive: true,
            selectedBranches: []
        });
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
        <div className="space-y-6" dir={dir}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-luxury-white">{t("admin.userManagement")}</h1>
                    <p className="text-luxury-white/60 mt-1">
                        {language === "ar" ? "إدارة فريق العمل وصلاحيات الفروع" : "Manage your team and their branch permissions"}
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-gold flex items-center gap-2 w-fit"
                    >
                        <Plus className="h-5 w-5" />
                        {t("admin.addUser")}
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="luxury-card transform transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-luxury-white">
                            {editingId ? t("admin.editUser") : t("admin.addUser")}
                        </h2>
                        <button onClick={resetForm} className="p-2 text-luxury-white/60 hover:text-luxury-white">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-luxury-white/80 mb-2">{t("admin.fullName")} *</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gold/50" />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:border-gold outline-none transition-colors"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-luxury-white/80 mb-2">{t("admin.email")} *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gold/50" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        disabled={!!editingId}
                                        className={`w-full pl-10 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:border-gold outline-none transition-colors ${editingId ? "opacity-50 cursor-not-allowed" : ""}`}
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>

                            {!editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-luxury-white/80 mb-2">{t("admin.password")} *</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gold/50" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:border-gold outline-none transition-colors"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-luxury-white/80 mb-2">{t("admin.role")} *</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white focus:border-gold outline-none transition-colors"
                                >
                                    <option value="staff">{t("admin.roleStaff")}</option>
                                    <option value="branch_manager">{t("admin.roleBranchManager")}</option>
                                    <option value="super_admin">{t("admin.roleSuperAdmin")}</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-luxury-white/80 mb-2">{t("admin.assignedBranches")}</label>
                                {formData.role === 'super_admin' ? (
                                    <div className="p-4 bg-gold/10 border border-gold/20 rounded-lg text-gold text-sm italic">
                                        {language === "ar" ? "مدير النظام لديه صلاحية الوصول لجميع الفروع." : "Super admins have access to all branches."}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gold/10 rounded-lg custom-scrollbar">
                                        {branches.map(branch => {
                                            const isSelected = formData.selectedBranches.includes(branch.id);
                                            return (
                                                <button
                                                    key={branch.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const newSelected = isSelected
                                                            ? formData.selectedBranches.filter(id => id !== branch.id)
                                                            : [...formData.selectedBranches, branch.id];
                                                        setFormData({ ...formData, selectedBranches: newSelected });
                                                    }}
                                                    className={`p-2 rounded border text-sm text-left transition-all ${isSelected
                                                        ? "bg-gold/20 border-gold text-gold shadow-lg shadow-gold/5"
                                                        : "bg-luxury-gray border-gold/10 text-luxury-white/60 hover:border-gold/30"
                                                        }`}
                                                >
                                                    {language === "ar" ? branch.name_ar : branch.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-luxury-white/80">{t("admin.activeStatus")}</label>
                                <button
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${formData.isActive ? "bg-green-500" : "bg-gray-600"}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${formData.isActive ? "left-6" : "left-0.5"}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                            {editingId ? t("common.update") : t("common.save")}
                        </button>
                        <button onClick={resetForm} className="px-6 py-3 border border-gold/30 rounded-lg text-luxury-white hover:bg-gold/10 transition-colors">
                            {t("common.cancel")}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="luxury-card overflow-hidden border border-gold/10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gold/20 bg-gold/5">
                                <th className="px-6 py-4 text-sm font-semibold text-gold">{t("admin.fullName")}</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gold">{t("admin.email")}</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gold">{t("admin.role")}</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gold">{t("admin.assignedBranches")}</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gold">{t("common.status")}</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gold text-right">{t("common.actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gold/10">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-gold/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-luxury-white font-medium">{emp.full_name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-luxury-white/60">
                                        {emp.email || "-"}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${emp.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            emp.role === 'branch_manager' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                'bg-gold/20 text-gold border border-gold/30'
                                            }`}>
                                            {emp.role === 'super_admin' ? t("admin.roleSuperAdmin") :
                                                emp.role === 'branch_manager' ? t("admin.roleBranchManager") :
                                                    t("admin.roleStaff")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {emp.role === 'super_admin' ? (
                                                <span className="text-[11px] text-gold/80 italic">{t("admin.allBranches")}</span>
                                            ) : (
                                                emp.employee_branches && emp.employee_branches.length > 0
                                                    ? <span className="text-sm text-luxury-white/60">{emp.employee_branches.length} {t("admin.branches")}</span>
                                                    : <span className="text-sm text-luxury-white/30 italic">None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {emp.is_active ? (
                                            <div className="flex items-center gap-1.5 text-green-400 text-sm">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span className="hidden sm:inline">{t("common.active")}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                                <XCircle className="h-4 w-4" />
                                                <span className="hidden sm:inline">{t("common.inactive")}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEdit(emp)}
                                                className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-colors"
                                                title={t("common.edit")}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title={t("common.delete")}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
