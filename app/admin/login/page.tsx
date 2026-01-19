"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearEmployeeCache } from "@/lib/auth-helpers";
import { Crown, Mail, Lock, Loader2, AlertCircle } from "lucide-react";

function LoginFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Check for error in URL params (e.g., from inactive account redirect)
    useEffect(() => {
        const errorParam = searchParams.get('error');
        if (errorParam === 'account_inactive') {
            setError("حسابك معطل. الرجاء التواصل مع المدير. / Your account is inactive. Please contact admin.");
        }
    }, [searchParams]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter email and password");
            return;
        }

        try {
            setLoading(true);

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes("Invalid login")) {
                    setError("Invalid email or password");
                } else if (authError.message.includes("Email not confirmed")) {
                    setError("Please confirm your email first");
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (data.session) {
                // Clear employee cache before navigating to ensure fresh data
                clearEmployeeCache();
                router.push("/admin");
                router.refresh();
            } else {
                setError("Login failed. Please try again.");
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-luxury-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-gold/10 rounded-2xl mb-4">
                        <Crown className="h-12 w-12 text-gold" />
                    </div>
                    <h1 className="text-3xl font-bold text-luxury-white">Al-Taj Admin</h1>
                    <p className="text-luxury-white/60 mt-2">Sign in to access the dashboard</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="luxury-card">
                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6 text-red-400">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gold" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                                    placeholder="admin@altaj.iq"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-luxury-white/80 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gold" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-luxury-gray border border-gold/20 rounded-lg text-luxury-white placeholder-luxury-white/40 focus:outline-none focus:border-gold/50"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 py-4 bg-gold text-luxury-black font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="text-center text-luxury-white/40 text-sm mt-6">
                    شركة التاج لتأجير السيارات
                </p>
            </div>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-luxury-black flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
        }>
            <LoginFormContent />
        </Suspense>
    );
}
