"use client";

import { useLanguage } from "@/lib/language-context";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/30 hover:bg-gold/10 text-luxury-white transition-colors"
            title={language === "en" ? "Switch to Arabic" : "التبديل للإنجليزية"}
        >
            <Globe className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium">
                {language === "en" ? "العربية" : "English"}
            </span>
        </button>
    );
}
