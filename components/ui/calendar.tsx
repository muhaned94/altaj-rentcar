"use strict";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                month_caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium text-luxury-white",
                nav: "space-x-1 flex items-center",
                button_previous: cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-luxury-white hover:text-gold absolute left-1"
                ),
                button_next: cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-luxury-white hover:text-gold absolute right-1"
                ),
                month_grid: "w-full border-collapse space-y-1",
                weekdays: "flex",
                weekday:
                    "text-luxury-white/50 rounded-md w-9 font-normal text-[0.8rem]",
                week: "flex w-full mt-2",
                day: cn(
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 text-luxury-white flex items-center justify-center rounded-md"
                ),
                selected: "bg-gold text-black hover:bg-gold hover:text-black focus:bg-gold focus:text-black",
                today: "bg-white/10 text-luxury-white",
                outside: "text-luxury-white/30 aria-selected:bg-white/10 aria-selected:text-luxury-white/30",
                disabled: "text-luxury-white/20 opacity-50 decoration-red-500/50 line-through",
                range_middle: "aria-selected:bg-gold/10 aria-selected:text-luxury-white",
                range_end: "day-range-end",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) => {
                    const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
                    return <Icon className="h-4 w-4" />;
                },
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
