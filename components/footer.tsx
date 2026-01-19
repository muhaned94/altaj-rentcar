"use client";

import Link from "next/link";
import { Crown, Mail, Phone, MapPin, Facebook, Twitter, Instagram } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function Footer() {
    const currentYear = new Date().getFullYear();
    const { t, dir } = useLanguage();

    return (
        <footer className="bg-luxury-gray border-t border-gold/20" dir={dir}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Main Footer Content */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                    {/* Company Info */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Crown className="h-6 w-6 text-gold" />
                            <div className="text-xl font-bold text-gold">{t("hero.alTaj")}</div>
                        </div>
                        <p className="text-luxury-white/60 text-sm mb-3 font-arabic">
                            شركة التاج لتأجير السيارات
                        </p>
                        <p className="text-luxury-white/60 text-sm">
                            {t("about.storyText")}
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-luxury-white font-semibold mb-4">{t("footer.quickLinks")}</h3>
                        <ul className="space-y-2">
                            {[
                                { href: "/", label: t("nav.home") },
                                { href: "/cars", label: t("nav.cars") },
                                { href: "/about", label: t("nav.about") },
                                { href: "/contact", label: t("nav.contact") },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-luxury-white/60 hover:text-gold transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-luxury-white font-semibold mb-4">{t("footer.contactUs")}</h3>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-sm">
                                <Phone className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" />
                                <span className="text-luxury-white/60" dir="ltr">+964 770 000 0001</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                                <Mail className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" />
                                <span className="text-luxury-white/60">info@altaj-rental.com</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" />
                                <span className="text-luxury-white/60">Baghdad, Iraq - Al-Jadriya</span>
                            </li>
                        </ul>
                    </div>

                    {/* Social Media */}
                    <div>
                        <h3 className="text-luxury-white font-semibold mb-4">{t("footer.followUs")}</h3>
                        <div className="flex gap-3">
                            {[
                                { Icon: Facebook, href: "#" },
                                { Icon: Twitter, href: "#" },
                                { Icon: Instagram, href: "#" },
                            ].map(({ Icon, href }, idx) => (
                                <a
                                    key={idx}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold transition-colors"
                                    aria-label={`Social media link ${idx + 1}`}
                                >
                                    <Icon className="h-5 w-5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-gold/20">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-luxury-white/60 text-sm text-center sm:text-left">
                            {t("footer.rights").replace("{year}", currentYear.toString())}
                        </p>
                        <div className="flex gap-6 text-sm">
                            <Link
                                href="/privacy"
                                className="text-luxury-white/60 hover:text-gold transition-colors"
                            >
                                {t("footer.privacy")}
                            </Link>
                            <Link
                                href="/terms"
                                className="text-luxury-white/60 hover:text-gold transition-colors"
                            >
                                {t("footer.terms")}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
