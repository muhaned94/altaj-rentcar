"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { ScrollText, Search, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Log {
    id: string;
    created_at: string;
    user_email: string;
    action: string;
    resource_id: string;
    details: string;
}

export default function LogsPage() {
    const { t, language, dir } = useLanguage();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    async function fetchLogs(silent = false) {
        try {
            if (!silent) setLoading(true);
            const { data, error } = await supabase
                .from("audit_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    // Real-time Subscription + Smart Polling
    useEffect(() => {
        // Initial Fetch
        fetchLogs();

        // 1. Setup Realtime Subscription
        const channel = supabase
            .channel('audit-logs-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs'
                },
                () => {
                    fetchLogs(true);
                }
            )
            .subscribe();

        // 2. Setup Polling (Auto-refresh every 10 seconds)
        const intervalId = setInterval(() => {
            fetchLogs(true);
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, []);

    const filteredLogs = logs.filter(log =>
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getActionColor = (action: string) => {
        if (action.includes("APPROVE")) return "text-green-400";
        if (action.includes("EDIT") || action.includes("UPDATE")) return "text-blue-400";
        if (action.includes("REJECT") || action.includes("DELETE")) return "text-red-400";
        return "text-gold";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-luxury-gray/50 p-4 rounded-xl border border-gold/20">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gold/20 rounded-lg">
                        <ScrollText className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-luxury-white">
                            {language === "ar" ? "سجل النشاطات" : "Audit Logs"}
                        </h1>
                        <p className="text-luxury-white/60 text-sm">
                            {language === "ar" ? "تتبع حركات النظام والموظفين" : "Track system actions and employee activity"}
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40" />
                    <input
                        type="text"
                        placeholder={language === "ar" ? "بحث في السجل..." : "Search logs..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-luxury-black/50 border border-gold/10 rounded-lg pl-9 pr-4 py-2 text-sm text-luxury-white focus:border-gold/50 focus:outline-none w-64"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-luxury-gray/30 border border-gold/20 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="h-8 w-8 text-gold animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-start border-collapse" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                            <thead>
                                <tr className="border-b border-gold/10 bg-luxury-black/20 text-xs uppercase text-luxury-white/60">
                                    <th className="p-4 w-32">{language === "ar" ? "الوقت" : "Time"}</th>
                                    <th className="p-4 w-32">{language === "ar" ? "المسؤول" : "Admin"}</th>
                                    <th className="p-4 w-32">{language === "ar" ? "الإجراء" : "Action"}</th>
                                    <th className="p-4 w-40">{language === "ar" ? "الزبون" : "Customer"}</th>
                                    <th className="p-4 w-48">{language === "ar" ? "السيارة" : "Car"}</th>
                                    <th className="p-4">{language === "ar" ? "التفاصيل" : "Details"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gold/5">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-luxury-white/40">
                                            {language === "ar" ? "لا توجد سجلات" : "No logs found"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => {
                                        // Simple manual parsing of the details string
                                        const parts = log.details?.includes("|")
                                            ? log.details.split("|").reduce((acc: any, part) => {
                                                const [k, v] = part.split(":").map(s => s.trim());
                                                if (k && v) acc[k.toLowerCase()] = v;
                                                return acc;
                                            }, {})
                                            : null;

                                        // Translation Maps
                                        const actionMap: Record<string, string> = {
                                            'APPROVE_BOOKING': 'قبول حجز',
                                            'REJECT_BOOKING': 'رفض حجز',
                                            'COMPLETE_BOOKING': 'إكمال حجز',
                                            'UPDATE_STATUS': 'تحديث حالة',
                                            'EDIT_BOOKING': 'تعديل حجز',
                                            'DELETE_BOOKING': 'حذف حجز',
                                            'NEW_BOOKING_REQUEST': 'طلب حجز جديد'
                                        };

                                        const statusMap: Record<string, string> = {
                                            'confirmed': 'مؤكد',
                                            'cancelled': 'ملغي',
                                            'completed': 'مكتمل',
                                            'pending': 'قيد الانتظار'
                                        };

                                        // Status Colors
                                        const getStatusColor = (s: string) => {
                                            switch (s) {
                                                case 'confirmed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                                                case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
                                                case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
                                                case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                                                default: return 'bg-white/5 border-white/10 text-white/60';
                                            }
                                        };

                                        // Get Display Values
                                        const displayAction = language === 'ar'
                                            ? (actionMap[log.action] || log.action)
                                            : log.action.replace('_BOOKING', '').replace('_', ' ');

                                        const rawStatus = parts ? parts['status'] : '';
                                        const displayStatus = (language === 'ar' && statusMap[rawStatus])
                                            ? statusMap[rawStatus.toLowerCase()]
                                            : (rawStatus || (log.details.length > 50 ? log.details.substring(0, 50) + '...' : log.details));

                                        const color = parts ? (parts['color'] || '').toLowerCase() : null;

                                        return (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm group">
                                                {/* Time */}
                                                <td className="p-4 text-luxury-white/60 font-mono whitespace-nowrap align-top">
                                                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                                                </td>

                                                {/* Admin */}
                                                <td className="p-4 align-top">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-white/10 rounded-full">
                                                            <User className="h-3 w-3 text-luxury-white" />
                                                        </div>
                                                        <span className="text-luxury-white text-xs max-w-[120px] truncate" title={log.user_email}>
                                                            {log.user_email?.split('@')[0] || 'System'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className={`p-4 font-bold text-xs align-top ${getActionColor(log.action)}`}>
                                                    {displayAction}
                                                </td>

                                                {/* Customer */}
                                                <td className="p-4 text-luxury-white align-top">
                                                    {parts ? parts['customer'] : "-"}
                                                </td>

                                                {/* Car */}
                                                <td className="p-4 text-luxury-white/80 align-top">
                                                    {parts ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-white">{parts['car']}</span>
                                                                {color && (
                                                                    <div
                                                                        className="w-3 h-3 rounded-full border border-white/30 shadow-sm"
                                                                        style={{ backgroundColor: color }}
                                                                        title={`Color: ${parts['color']}`}
                                                                    />
                                                                )}
                                                            </div>
                                                            {parts['plate'] && (
                                                                <span className="text-[10px] text-gold/80 font-mono bg-black/40 px-1.5 py-0.5 rounded w-fit">
                                                                    {parts['plate']}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : "-"}
                                                </td>

                                                {/* Details */}
                                                <td className="p-4 text-luxury-white/70 text-xs align-top">
                                                    <div className="whitespace-pre-wrap">
                                                        {parts ? (
                                                            <div className="space-y-1">
                                                                {Object.entries(parts).map(([key, value]) => {
                                                                    // Skip some internal keys if visual representation handles them (like color, car, plate which are handled in previous column)
                                                                    if (['car', 'plate', 'color', 'status'].includes(key)) return null;

                                                                    // Translation Map for Keys
                                                                    const keyMap: Record<string, string> = {
                                                                        'customer': 'الزبون',
                                                                        'branch': 'الفرع',
                                                                        'total': 'المجموع',
                                                                        'from': 'من',
                                                                        'email': 'البريد',
                                                                        'phone': 'الهاتف',
                                                                        'message': 'الرسالة'
                                                                    };

                                                                    const displayKey = language === 'ar' ? (keyMap[key] || key) : key.charAt(0).toUpperCase() + key.slice(1);
                                                                    const displayValue = (value as string); // Add specific value translation if needed

                                                                    return (
                                                                        <div key={key}>
                                                                            <span className="text-luxury-white/40">{displayKey}:</span> <span className="text-luxury-white/80">{displayValue}</span>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {/* Helper to show status if it exists in parts but we skipped it above, 
                                                                    conceptually we might want to just show the status badge and not list it as text, 
                                                                    but existing code used it for badge. Let's keep the badge logic below intact. */}
                                                            </div>
                                                        ) : null}

                                                        {parts && parts['status'] ? (
                                                            <span className={`inline-block px-2 py-1 rounded border mb-1 ${getStatusColor(parts['status'])}`}>
                                                                {displayStatus}
                                                            </span>
                                                        ) : (
                                                            /* Fallback for non-parsed details */
                                                            !parts && <span>{displayStatus}</span>
                                                        )}
                                                        {/* Show diff changes if any */}
                                                        {log.details.includes("->") && (
                                                            <div className="mt-1 text-white/50 space-y-0.5">
                                                                {log.details.split('|').filter(p => p.includes("->")).map((p, i) => (
                                                                    <div key={i}>{p.trim()}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
