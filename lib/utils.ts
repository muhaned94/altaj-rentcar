import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, language: string = 'en'): string {
    if (language === 'ar') {
        return new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount) + ' د.ع';
    }
    return 'IQD ' + new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(date: string | Date, locale: string = 'en-US'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(dateObj);
}

export function calculateDays(startDate: string | Date, endDate: string | Date): number {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

export function calculateTotalAmount(dailyRate: number, startDate: string | Date, endDate: string | Date): number {
    const days = calculateDays(startDate, endDate);
    return dailyRate * Math.max(days, 1); // Minimum 1 day
}

export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        available: 'text-green-500',
        rented: 'text-yellow-500',
        maintenance: 'text-red-500',
        pending: 'text-yellow-500',
        confirmed: 'text-blue-500',
        completed: 'text-green-500',
        cancelled: 'text-red-500',
    };
    return colors[status] || 'text-gray-500';
}

export function getStatusBadge(status: string): string {
    const badges: Record<string, string> = {
        available: 'bg-green-500/20 text-green-400 border-green-500/30',
        rented: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        maintenance: 'bg-red-500/20 text-red-400 border-red-500/30',
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        completed: 'bg-green-500/20 text-green-400 border-green-500/30',
        cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return badges[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}
