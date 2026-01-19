"use client";

import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Crown, Award, Shield, Users, Truck, MapPin, HelpCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function AboutPage() {
    const { t, dir } = useLanguage();

    return (
        <div dir={dir}>
            <Navbar />
            <div className="min-h-screen bg-luxury-black py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <Crown className="h-16 w-16 text-gold mx-auto mb-6" />
                        <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                            <span className="text-gold-gradient">{t("about.title")} {t("about.titleHighlight")}</span>
                        </h1>
                        <p className="text-2xl font-arabic text-gold mb-8">شركة التاج لتأجير السيارات</p>
                        <p className="text-luxury-white/70 text-lg max-w-3xl mx-auto">
                            {t("about.heroSubtitle")}
                        </p>
                    </div>

                    {/* Our Story */}
                    <div className="luxury-card mb-12 text-start">
                        <h2 className="text-2xl font-bold text-gold mb-4">{t("about.story")}</h2>
                        <div className="space-y-4">
                            <p className="text-luxury-white/70 leading-relaxed">
                                {t("about.storyPart1")}
                            </p>
                            <p className="text-luxury-white/70 leading-relaxed">
                                {t("about.storyPart2")}
                            </p>
                        </div>
                    </div>

                    {/* Why Choose Us */}
                    <div className="mb-16">
                        <h2 className="text-3xl font-bold text-center mb-10">
                            <span className="text-gold-gradient">{t("about.whyChoose")}</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    icon: Crown,
                                    title: t("about.premiumFleet"),
                                    description: t("about.premiumFleetDesc"),
                                },
                                {
                                    icon: Award,
                                    title: t("about.bestPrices"),
                                    description: t("about.bestPricesDesc"),
                                },
                                {
                                    icon: Shield,
                                    title: t("about.insured"),
                                    description: t("about.insuredDesc"),
                                },
                                {
                                    icon: Users,
                                    title: t("about.service247"),
                                    description: t("about.service247Desc"),
                                },
                            ].map((feature, idx) => (
                                <div key={idx} className="luxury-card text-center">
                                    <feature.icon className="h-12 w-12 text-gold mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-luxury-white mb-3">
                                        {feature.title}
                                    </h3>
                                    <p className="text-luxury-white/60 text-sm">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Services Section */}
                    <div className="mb-20">
                        <h2 className="text-3xl font-bold text-center mb-10">
                            <span className="text-gold-gradient">{t("about.servicesTitle")}</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: Truck,
                                    title: t("about.service1Title"),
                                    desc: t("about.service1Desc")
                                },
                                {
                                    icon: MapPin,
                                    title: t("about.service2Title"),
                                    desc: t("about.service2Desc")
                                },
                                {
                                    icon: ShieldCheck,
                                    title: t("about.service3Title"),
                                    desc: t("about.service3Desc")
                                }
                            ].map((service, idx) => (
                                <div key={idx} className="luxury-card flex flex-col items-center text-center group hover:border-gold/50 transition-all duration-300">
                                    <div className="p-4 rounded-full bg-gold/10 mb-6 group-hover:bg-gold/20 transition-colors">
                                        <service.icon className="h-8 w-8 text-gold" />
                                    </div>
                                    <h3 className="text-xl font-bold text-luxury-white mb-4">{service.title}</h3>
                                    <p className="text-luxury-white/60 leading-relaxed text-sm">{service.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Our Mission */}
                    <div className="luxury-card mb-20 bg-gold-gradient">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-luxury-black mb-4">{t("about.mission")}</h2>
                            <p className="text-luxury-black/80 leading-relaxed max-w-3xl mx-auto font-medium">
                                {t("about.missionDescription")}
                            </p>
                        </div>
                    </div>

                    {/* Values */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
                        {[
                            {
                                title: t("about.excellence"),
                                description: t("about.excellenceDesc"),
                            },
                            {
                                title: t("about.trust"),
                                description: t("about.trustDesc"),
                            },
                            {
                                title: t("about.innovation"),
                                description: t("about.innovationDesc"),
                            },
                        ].map((value, idx) => (
                            <div key={idx} className="luxury-card text-start">
                                <h3 className="text-xl font-semibold text-gold mb-3">{value.title}</h3>
                                <p className="text-luxury-white/70">{value.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* FAQ Section */}
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12">
                            <HelpCircle className="h-12 w-12 text-gold mx-auto mb-4" />
                            <h2 className="text-3xl font-bold">
                                <span className="text-gold-gradient">{t("about.faqTitle")}</span>
                            </h2>
                        </div>

                        <div className="space-y-6">
                            {[
                                {
                                    q: t("about.faq1Q"),
                                    a: [t("about.faq1A1"), t("about.faq1A2")]
                                },
                                {
                                    q: t("about.faq2Q"),
                                    a: [t("about.faq2A1"), t("about.faq2A2")]
                                },
                                {
                                    q: t("about.faq3Q"),
                                    a: [t("about.faq3A1"), t("about.faq3A2")]
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="luxury-card border-l-4 border-l-gold text-start">
                                    <h3 className="text-lg font-bold text-luxury-white mb-4 flex items-center gap-2">
                                        <span className="text-gold">Q:</span>
                                        {item.q}
                                    </h3>
                                    <div className="space-y-3">
                                        {item.a.map((ans, aIdx) => (
                                            <div key={aIdx} className="flex gap-3 text-luxury-white/70 text-sm leading-relaxed">
                                                <CheckCircle2 className="h-5 w-5 text-gold/50 flex-shrink-0 mt-0.5" />
                                                <p>{ans}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
