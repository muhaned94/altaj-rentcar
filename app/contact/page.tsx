
"use client";

import { useState } from "react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Mail, Phone, MapPin, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { useLanguage } from "@/lib/language-context";

export default function ContactPage() {
    const { t, dir } = useLanguage();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        message: "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { error: submitError } = await supabase
                .from('contact_messages')
                .insert([
                    {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone,
                        message: formData.message,
                        status: 'unread'
                    }
                ]);

            if (submitError) throw submitError;

            // Log New Contact Message
            await logAction(
                'NEW_CONTACT_MESSAGE',
                'unread',
                `From: ${formData.name} (${formData.email})`
            );

            setSuccess(true);
            setFormData({ name: "", email: "", phone: "", message: "" });
        } catch (err: any) {
            console.error('Error submitting contact form:', err);
            setError(err.message || (dir === 'rtl' ? 'حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.' : 'An error occurred while sending the message. Please try again.'));
        } finally {
            setLoading(false);
            // Hide success message after 5 seconds
            if (success) {
                setTimeout(() => setSuccess(false), 5000);
            }
        }
    };

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                            <span className="text-gold-gradient">{t("contact.title")} {t("contact.titleHighlight")}</span>
                        </h1>
                        <p className="text-luxury-white/70 text-lg max-w-2xl mx-auto">
                            {t("contact.subtitle")}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Contact Information */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="luxury-card">
                                <Phone className="h-8 w-8 text-gold mb-4" />
                                <h3 className="text-lg font-semibold text-luxury-white mb-2">{t("contact.phone")}</h3>
                                <p className="text-luxury-white/60" dir="ltr">+964 770 000 0001</p>
                                <p className="text-luxury-white/60 mt-1">{t("contact.monFri")}</p>
                            </div>

                            <div className="luxury-card">
                                <Mail className="h-8 w-8 text-gold mb-4" />
                                <h3 className="text-lg font-semibold text-luxury-white mb-2">{t("contact.email")}</h3>
                                <p className="text-luxury-white/60">info@altaj-rental.com</p>
                                <p className="text-luxury-white/60 mt-1">support@altaj-rental.com</p>
                            </div>

                            <div className="luxury-card">
                                <MapPin className="h-8 w-8 text-gold mb-4" />
                                <h3 className="text-lg font-semibold text-luxury-white mb-2">{t("contact.address")}</h3>
                                <p className="text-luxury-white/60">Al-Jadriya Road</p>
                                <p className="text-luxury-white/60">Baghdad</p>
                                <p className="text-luxury-white/60 mt-1">Iraq</p>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div className="lg:col-span-2">
                            <div className="luxury-card">
                                <h2 className="text-2xl font-bold text-gold mb-6">{t("contact.formTitle")}</h2>

                                {success && (
                                    <div className="mb-6 p-4 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span>{t("contact.successMessage")}</span>
                                    </div>
                                )}

                                {error && (
                                    <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-3">
                                        <AlertCircle className="h-5 w-5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                            {t("contact.fullName")} *
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                                            placeholder={t("contact.placeholderName")}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                {t("contact.emailAddr")} *
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                                                placeholder={t("contact.placeholderEmail")}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="phone" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                                {t("contact.phoneNum")}
                                            </label>
                                            <input
                                                type="tel"
                                                id="phone"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                                                placeholder={t("contact.placeholderPhone")}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="message" className="block text-sm font-medium text-luxury-white/80 mb-2">
                                            {t("contact.messageLabel")} *
                                        </label>
                                        <textarea
                                            id="message"
                                            required
                                            rows={6}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50 resize-none"
                                            placeholder={t("contact.placeholderMessage")}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn-gold w-full sm:w-auto flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                {t("contact.sending")}
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5" />
                                                {t("contact.sendMessage")}
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
