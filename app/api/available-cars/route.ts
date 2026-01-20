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
            .select("car_id, inventory_id")
            .in("status", ["pending", "confirmed"])
            .lte("start_date", endDate)
            .gte("end_date", startDate);

        if (bookingsError) {
            console.error("Error fetching bookings:", bookingsError);
            return NextResponse.json({ error: bookingsError.message }, { status: 500 });
        }

        // Get Inventory Items
        const { data: inventoryData, error: inventoryError } = await supabase
            .from("car_inventory")
            .select("id, car_id, plate_number, color, status")
            .neq("status", "maintenance");

        if (inventoryError) {
            console.error("Error fetching inventory:", inventoryError);
            return NextResponse.json({ error: inventoryError.message }, { status: 500 });
        }

        // Get booked inventory IDs
        const bookedInventoryIds = new Set<string>();
        // And count anonymous bookings per car (bookings without inventory_id assigned yet)
        const anonymousBookingsCount: Record<string, number> = {};

        conflictingBookings?.forEach(b => {
            if (b.inventory_id) {
                bookedInventoryIds.add(b.inventory_id);
            } else {
                anonymousBookingsCount[b.car_id] = (anonymousBookingsCount[b.car_id] || 0) + 1;
            }
        });

        // Map Inventory to Cars
        const inventoryByCar: Record<string, typeof inventoryData> = {};
        inventoryData?.forEach(item => {
            if (!inventoryByCar[item.car_id]) inventoryByCar[item.car_id] = [];
            inventoryByCar[item.car_id].push(item);
        });

        const availableCars = allCars?.map((car) => {
            const carInventory = inventoryByCar[car.id] || [];

            // Filter out specifically booked units
            let availableUnits = carInventory.filter(unit => !bookedInventoryIds.has(unit.id));

            // Check availability including anonymous bookings
            const anonCount = anonymousBookingsCount[car.id] || 0;
            const isAvailable = (availableUnits.length - anonCount) > 0;

            if (!isAvailable) return null;

            return {
                ...car,
                available_units: availableUnits // Frontend can visualize these
            };
        }).filter(Boolean) || [];

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
