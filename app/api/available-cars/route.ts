import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Public API - use ANON_KEY only (RLS provides protection)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("start_date");
        const endDate = searchParams.get("end_date");

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "start_date and end_date are required" },
                { status: 400 }
            );
        }

        const branchId = searchParams.get("branch_id");

        // Start building the query
        let query = supabase
            .from("cars")
            .select("*, category:categories(*), car_branches!inner(branch_id)")
            .eq("status", "available")
            .order("created_at", { ascending: false });

        // If branch_id is provided, filter using the inner join on car_branches
        if (branchId) {
            query = query.eq("car_branches.branch_id", branchId);
        }

        const { data: allCars, error: carsError } = await query;

        if (carsError) {
            console.error("Error fetching cars:", carsError);
            return NextResponse.json({ error: carsError.message }, { status: 500 });
        }

        // Get bookings that overlap with the requested dates
        const { data: conflictingBookings, error: bookingsError } = await supabase
            .from("bookings")
            .select("car_id")
            .in("status", ["pending", "confirmed"])
            .lte("start_date", endDate)
            .gte("end_date", startDate);

        if (bookingsError) {
            console.error("Error fetching bookings:", bookingsError);
            return NextResponse.json({ error: bookingsError.message }, { status: 500 });
        }

        const bookedCarIds = new Set(conflictingBookings?.map((b) => b.car_id) || []);

        const availableCars = allCars?.filter((car) => !bookedCarIds.has(car.id)) || [];

        return NextResponse.json({
            cars: availableCars,
            total: availableCars.length,
            requestedDates: { startDate, endDate }
        });
    } catch (error: any) {
        console.error("Error in available-cars API:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
