import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Use getUser instead of getSession for better security
    let user = null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            // Ignore "AuthSessionMissingError" as it just means no session
            if (error.name !== "AuthSessionMissingError" && error.message !== "Auth session missing!") {
                console.error("Supabase auth error in middleware:", error);
            }
        }
        user = data?.user;
    } catch (e) {
        console.error("Unexpected error in middleware auth check:", e);
    }

    // Protect admin routes (except login)
    if (request.nextUrl.pathname.startsWith("/admin")) {
        if (request.nextUrl.pathname === "/admin/login") {
            // If already logged in, redirect to admin dashboard
            if (user) {
                return NextResponse.redirect(new URL("/admin", request.url));
            }
            return response;
        }

        // Not logged in, redirect to login
        if (!user) {
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
    }

    return response;
}

export const config = {
    matcher: ["/admin/:path*"],
};
