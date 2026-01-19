
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Crown, Car, Calendar, Phone, Home } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import LanguageSwitcher from "@/components/language-switcher";

export default function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t, dir, language } = useLanguage();

    const navLinks = [
        { href: "/", label: t("nav.home"), icon: Home },
        { href: "/cars", label: t("nav.cars"), icon: Car },
        { href: "/about", label: t("nav.about"), icon: Crown },
        { href: "/contact", label: t("nav.contact"), icon: Phone },
    ];

    return (
        <>
            {/* Desktop & Tablet Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-gold/20" dir={dir}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="p-2 rounded-lg bg-gold/10 group-hover:bg-gold/20 transition-colors">
                                <Crown className="h-6 w-6 text-gold" />
                            </div>
                            <div className="flex flex-col">
                                <div className="text-xl font-bold text-gold leading-tight">
                                    {t("nav.companyName")}
                                </div>
                                <div className="text-[10px] text-luxury-white/60 uppercase tracking-widest leading-none">
                                    {t("nav.tagline")}
                                </div>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="px-4 py-2 rounded-lg text-luxury-white/80 hover:text-gold hover:bg-gold/10 transition-all duration-200 flex items-center gap-2"
                                >
                                    <link.icon className="h-4 w-4" />
                                    <span>{link.label}</span>
                                </Link>
                            ))}
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-3">
                            <LanguageSwitcher />
                            <Link href="/book" className="btn-gold text-sm">
                                {t("nav.bookNow")}
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center gap-2">
                            <LanguageSwitcher />
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="p-2 rounded-lg text-luxury-white hover:bg-gold/10 hover:text-gold transition-colors"
                                aria-label="Toggle mobile menu"
                            >
                                {isMobileMenuOpen ? (
                                    <X className="h-6 w-6" />
                                ) : (
                                    <Menu className="h-6 w-6" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Drawer */}
            <div
                className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${isMobileMenuOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                    }`}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                {/* Drawer */}
                <div
                    className={`absolute top-0 ${dir === "rtl" ? "left-0 border-r" : "right-0 border-l"} h-full w-64 bg-luxury-gray border-gold/20 transform transition-transform duration-300 ${isMobileMenuOpen
                        ? "translate-x-0"
                        : dir === "rtl" ? "-translate-x-full" : "translate-x-full"
                        }`}
                    dir={dir}
                >
                    <div className="p-6 pt-20">
                        {/* Mobile Navigation Links */}
                        <div className="space-y-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-luxury-white hover:text-gold hover:bg-gold/10 transition-all duration-200"
                                >
                                    <link.icon className="h-5 w-5" />
                                    <span className="font-medium">{link.label}</span>
                                </Link>
                            ))}
                        </div>

                        {/* Mobile CTA */}
                        <div className="mt-6 pt-6 border-t border-gold/20">
                            <Link
                                href="/book"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="btn-gold w-full text-center block"
                            >
                                {t("nav.bookNow")}
                            </Link>
                        </div>

                        {/* Branding */}
                        <div className="mt-6 text-center">
                            <div className="text-gold font-bold text-lg">
                                {t("nav.companyName")}
                            </div>
                            <div className="text-luxury-white/40 text-sm mt-1 uppercase tracking-wider">
                                {t("nav.tagline")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer to prevent content from going under fixed navbar */}
            <div className="h-16" />
        </>
    );
}
