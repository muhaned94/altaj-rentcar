import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import WhatsAppButton from "@/components/whatsapp-button";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

const cairo = Cairo({
    subsets: ["arabic", "latin"],
    variable: "--font-cairo",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Al-Taj Car Rental | شركة التاج لتأجير السيارات",
    description: "Premium luxury car rental service in Iraq. Al-Taj Company offers the finest selection of vehicles for your travel needs.",
    keywords: ["car rental", "luxury cars", "Al-Taj", "Iraq", "Baghdad", "تأجير سيارات", "العراق"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <body className={`${inter.variable} ${cairo.variable} font-sans`}>
                <LanguageProvider>
                    {children}
                    <WhatsAppButton />
                </LanguageProvider>
            </body>
        </html >
    );
}
