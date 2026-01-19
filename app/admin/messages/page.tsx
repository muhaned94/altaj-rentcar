"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, User, Phone, Calendar, Trash2, CheckCircle, Clock, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/language-context";
import { ContactMessage } from "@/lib/types";

export default function AdminMessagesPage() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const { language } = useLanguage();

    useEffect(() => {
        fetchMessages();

        const channel = supabase
            .channel('admin-messages-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'contact_messages' },
                () => {
                    fetchMessages();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchMessages() {
        try {
            setLoading(true);
            let query = supabase
                .from("contact_messages")
                .select("*")
                .order("created_at", { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setLoading(false);
        }
    }

    async function updateMessageStatus(id: string, status: 'read' | 'unread' | 'archived') {
        try {
            const { error } = await supabase
                .from("contact_messages")
                .update({ status })
                .eq("id", id);

            if (error) throw error;
            // Success - state will update via realtime subscription
        } catch (error) {
            console.error("Error updating message status:", error);
        }
    }

    async function deleteMessage(id: string) {
        if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الرسالة؟" : "Are you sure you want to delete this message?")) return;

        try {
            const { error } = await supabase
                .from("contact_messages")
                .delete()
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    }

    const filteredMessages = messages.filter(msg => {
        const matchesSearch =
            msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            msg.message.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" || msg.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const isAr = language === "ar";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-luxury-white">
                    {isAr ? "رسائل تواصل معنا" : "Contact Messages"}
                </h1>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-white/40" />
                        <input
                            type="text"
                            placeholder={isAr ? "بحث..." : "Search..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 w-full sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-luxury-gray rounded-lg w-fit border border-gold/10">
                <button
                    onClick={() => setFilterStatus("all")}
                    className={`px-4 py-1.5 rounded-md text-sm transition-all ${filterStatus === "all" ? "bg-gold text-black font-bold" : "text-luxury-white/60 hover:text-gold"}`}
                >
                    {isAr ? "الكل" : "All"}
                </button>
                <button
                    onClick={() => setFilterStatus("unread")}
                    className={`px-4 py-1.5 rounded-md text-sm transition-all ${filterStatus === "unread" ? "bg-gold text-black font-bold" : "text-luxury-white/60 hover:text-gold"}`}
                >
                    {isAr ? "غير مقروءة" : "Unread"}
                </button>
                <button
                    onClick={() => setFilterStatus("read")}
                    className={`px-4 py-1.5 rounded-md text-sm transition-all ${filterStatus === "read" ? "bg-gold text-black font-bold" : "text-luxury-white/60 hover:text-gold"}`}
                >
                    {isAr ? "مقروءة" : "Read"}
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
                </div>
            ) : filteredMessages.length === 0 ? (
                <div className="text-center py-20 bg-luxury-gray rounded-xl border border-gold/10">
                    <Mail className="h-12 w-12 text-gold/20 mx-auto mb-4" />
                    <p className="text-luxury-white/60">
                        {isAr ? "لا توجد رسائل للعرض" : "No messages found"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`luxury-card border-l-4 transition-all ${msg.status === 'unread' ? 'border-l-gold bg-gold/5' : 'border-l-transparent opacity-80'}`}
                        >
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gold/10 rounded-full">
                                            <User className="h-5 w-5 text-gold" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-luxury-white">{msg.name}</h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-luxury-white/60">
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {msg.email}
                                                </span>
                                                {msg.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> {msg.phone}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(msg.created_at), "PPP p", { locale: isAr ? ar : undefined })}
                                                </span>
                                            </div>
                                        </div>
                                        {msg.status === 'unread' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gold text-black uppercase ml-auto">
                                                {isAr ? "جديد" : "New"}
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-luxury-black/40 p-4 rounded-lg border border-gold/5 text-luxury-white/80 whitespace-pre-wrap">
                                        {msg.message}
                                    </div>
                                </div>

                                <div className="flex md:flex-col gap-2 justify-end">
                                    {msg.status === 'unread' ? (
                                        <button
                                            onClick={() => updateMessageStatus(msg.id, 'read')}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-sm transition-colors"
                                            title={isAr ? "تحديد كمقروء" : "Mark as Read"}
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                            <span className="hidden lg:inline">{isAr ? "تمت القراءة" : "Mark Read"}</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => updateMessageStatus(msg.id, 'unread')}
                                            className="flex items-center gap-2 px-4 py-2 bg-luxury-gray text-luxury-white/40 hover:text-gold rounded-lg text-sm transition-colors"
                                            title={isAr ? "تحديد كغير مقروء" : "Mark as Unread"}
                                        >
                                            <Clock className="h-4 w-4" />
                                            <span className="hidden lg:inline">{isAr ? "غير مقروء" : "Mark Unread"}</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => deleteMessage(msg.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-colors"
                                        title={isAr ? "حذف" : "Delete"}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="hidden lg:inline">{isAr ? "حذف" : "Delete"}</span>
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
