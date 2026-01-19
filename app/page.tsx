"use client";

import Link from "next/link";
import { Car, Crown, ArrowRight } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { useLanguage } from "@/lib/language-context";


export default function HomePage() {
    const { t, dir } = useLanguage();

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black">
                {/* Hero Section */}
                <section className="relative h-screen flex items-center justify-center overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-luxury-black via-luxury-gray to-luxury-black opacity-90" />

                    {/* Gold accent overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gold/10 via-transparent to-transparent" />

                    {/* Content */}
                    <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                        {/* Crown Icon */}
                        <div className="flex justify-center mb-8">
                            <div className="p-6 rounded-full bg-gold/10 border-2 border-gold animate-pulse">
                                <Crown className="h-16 w-16 text-gold" />
                            </div>
                        </div>

                        {/* Company Name */}
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
                            <span className="text-gold-gradient">{t("hero.alTaj")}</span>
                            <span className="block mt-2 text-luxury-white">{t("hero.carRental")}</span>
                        </h1>

                        {/* Arabic Name - Only show if current language is not Arabic to avoid redundancy, or keep it for branding */}
                        <p className="text-2xl sm:text-3xl font-arabic text-gold mb-8">
                            شركة التاج لتأجير السيارات
                        </p>

                        {/* Tagline */}
                        <p className="text-lg sm:text-xl text-luxury-white/80 mb-12 max-w-2xl mx-auto">
                            {t("hero.tagline")}
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link
                                href="/cars"
                                className="btn-gold group flex items-center gap-2"
                            >
                                {t("hero.browseFleet")}
                                <Car className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                            </Link>

                            <Link
                                href="/about"
                                className="glass-dark px-6 py-3 rounded-lg text-luxury-white font-semibold transition-all duration-300 hover:border-gold flex items-center gap-2 group"
                            >
                                {t("hero.learnMore")}
                                <ArrowRight className={`h-5 w-5 group-hover:translate-x-1 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                            </Link>
                        </div>
                    </div>

                    {/* Decorative elements */}
                    <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-luxury-black to-transparent" />
                </section>

                {/* Quick Stats Section */}
                <section className="py-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { key: "stats.premiumCars", value: "50+", icon: Car },
                                { key: "stats.happyCustomers", value: "1000+", icon: Crown },
                                { key: "stats.yearsExperience", value: "10+", icon: Crown },
                                { key: "stats.citiesCovered", value: "5+", icon: Car },
                            ].map((stat, idx) => (
                                <div key={idx} className="luxury-card text-center">
                                    <stat.icon className="h-8 w-8 text-gold mx-auto mb-4" />
                                    <div className="text-3xl font-bold text-gold mb-2">{stat.value}</div>
                                    <div className="text-luxury-white/70">{t(stat.key)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
            <Footer />
        </div>
    );
}
