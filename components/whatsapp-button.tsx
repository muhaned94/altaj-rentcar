"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

export default function WhatsAppButton() {
    const { t, dir } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsVisible(true);
    }, []);

    // Hide on all admin pages
    if (pathname?.startsWith("/admin")) return null;

    if (!isVisible) return null;

    // Replace with actual number
    const phoneNumber = "9647700000001";
    const message = encodeURIComponent(t("common.whatsappMessage"));

    return (
        <Link
            href={`https://wa.me/${phoneNumber}?text=${message}`}
            target="_blank"
            className={`fixed bottom-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center gap-2 group border-2 border-white/20 print:hidden`}
            aria-label={t("common.chatWithUs")}
            dir={dir}
        >
            <MessageCircle className="h-8 w-8" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold">
                {t("common.chatWithUs")}
            </span>
        </Link>
    );
}
