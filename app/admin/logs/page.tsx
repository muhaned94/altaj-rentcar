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
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gold/10 bg-luxury-black/20 text-xs uppercase text-luxury-white/60">
                                    <th className="p-4">{language === "ar" ? "الوقت" : "Time"}</th>
                                    <th className="p-4">{language === "ar" ? "المسؤول" : "Admin"}</th>
                                    <th className="p-4">{language === "ar" ? "الإجراء" : "Action"}</th>
                                    <th className="p-4">{language === "ar" ? "الزبون" : "Customer"}</th>
                                    <th className="p-4">{language === "ar" ? "السيارة" : "Car"}</th>
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
                                        // Format: "Status: ... | Customer: ... | Car: ... | Dates: ..."
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
                                            'DELETE_BOOKING': 'حذف حجز'
                                        };

                                        const statusMap: Record<string, string> = {
                                            'confirmed': 'مؤكد',
                                            'cancelled': 'ملغي',
                                            'completed': 'مكتمل',
                                            'pending': 'قيد الانتظار'
                                        };

                                        // Get Display Values
                                        const displayAction = language === 'ar'
                                            ? (actionMap[log.action] || log.action)
                                            : log.action.replace('_BOOKING', '');

                                        const rawStatus = parts ? parts['status'] : '';
                                        const displayStatus = (language === 'ar' && statusMap[rawStatus])
                                            ? statusMap[rawStatus]
                                            : (rawStatus || (log.details.length > 30 ? log.details.substring(0, 30) + '...' : log.details));

                                        return (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm">
                                                {/* Time */}
                                                <td className="p-4 text-luxury-white/60 font-mono whitespace-nowrap">
                                                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                                                </td>

                                                {/* Admin */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-white/10 rounded-full">
                                                            <User className="h-3 w-3 text-luxury-white" />
                                                        </div>
                                                        <span className="text-luxury-white text-xs max-w-[150px] truncate" title={log.user_email}>
                                                            {log.user_email.split('@')[0]}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className={`p-4 font-bold text-xs ${getActionColor(log.action)}`}>
                                                    {displayAction}
                                                </td>

                                                {/* Customer (Parsed or -) */}
                                                <td className="p-4 text-luxury-white">
                                                    {parts ? parts['customer'] : "-"}
                                                </td>

                                                {/* Car (Parsed or -) */}
                                                <td className="p-4 text-luxury-white/80">
                                                    {parts ? parts['car'] : "-"}
                                                </td>

                                                {/* Details/Status */}
                                                <td className="p-4 text-luxury-white/60 text-xs max-w-xs truncate" title={log.details}>
                                                    {parts
                                                        ? <span className="px-2 py-1 rounded bg-white/5 border border-white/10">{displayStatus}</span>
                                                        : displayStatus
                                                    }
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
