"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle, Database, RefreshCw } from "lucide-react";

interface TestResult {
    name: string;
    status: "pending" | "success" | "error";
    message: string;
    data?: any;
}

export default function TestConnectionPage() {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);

    async function runTests() {
        setTesting(true);
        setResults([]);

        const tests: TestResult[] = [];

        // Test 1: Basic Connection
        try {
            const { data, error } = await supabase.from("categories").select("count");
            if (error) throw error;
            tests.push({
                name: "Database Connection",
                status: "success",
                message: "Successfully connected to Supabase database",
            });
        } catch (error: any) {
            tests.push({
                name: "Database Connection",
                status: "error",
                message: error.message || "Failed to connect to database",
            });
        }
        setResults([...tests]);

        // Test 2: Categories Table
        try {
            const { data, error, count } = await supabase
                .from("categories")
                .select("*", { count: "exact" });
            if (error) throw error;
            tests.push({
                name: "Categories Table",
                status: "success",
                message: `Found ${count || data?.length || 0} categories`,
                data: data?.slice(0, 3),
            });
        } catch (error: any) {
            tests.push({
                name: "Categories Table",
                status: "error",
                message: error.message || "Categories table not found",
            });
        }
        setResults([...tests]);

        // Test 3: Cars Table
        try {
            const { data, error, count } = await supabase
                .from("cars")
                .select("*", { count: "exact" });
            if (error) throw error;
            tests.push({
                name: "Cars Table",
                status: "success",
                message: `Found ${count || data?.length || 0} cars`,
                data: data?.slice(0, 3),
            });
        } catch (error: any) {
            tests.push({
                name: "Cars Table",
                status: "error",
                message: error.message || "Cars table not found",
            });
        }
        setResults([...tests]);

        // Test 4: Bookings Table
        try {
            const { data, error, count } = await supabase
                .from("bookings")
                .select("*", { count: "exact" });
            if (error) throw error;
            tests.push({
                name: "Bookings Table",
                status: "success",
                message: `Found ${count || data?.length || 0} bookings`,
            });
        } catch (error: any) {
            tests.push({
                name: "Bookings Table",
                status: "error",
                message: error.message || "Bookings table not found",
            });
        }
        setResults([...tests]);

        // Test 5: Storage Bucket - try to list files instead of getBucket (which needs admin)
        try {
            const { data, error } = await supabase.storage
                .from("car-images")
                .list("", { limit: 1 });

            if (error) throw error;
            tests.push({
                name: "Storage Bucket (car-images)",
                status: "success",
                message: "Storage bucket exists and is accessible",
            });
        } catch (error: any) {
            tests.push({
                name: "Storage Bucket (car-images)",
                status: "error",
                message: error.message || "Storage bucket not found - please create it in Supabase",
            });
        }
        setResults([...tests]);

        setTesting(false);
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return (
        <div className="min-h-screen bg-luxury-black py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <Database className="h-16 w-16 text-gold mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-luxury-white">
                        Database Connection Test
                    </h1>
                    <p className="text-luxury-white/60 mt-2">
                        اختبار الاتصال بقاعدة البيانات Supabase
                    </p>
                </div>

                {/* Environment Check */}
                <div className="luxury-card mb-6">
                    <h2 className="text-lg font-semibold text-luxury-white mb-3">Environment Variables</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-luxury-white/60">SUPABASE_URL:</span>
                            <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? "text-green-400" : "text-red-400"}>
                                {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "✗ Missing"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-luxury-white/60">SUPABASE_ANON_KEY:</span>
                            <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "text-green-400" : "text-red-400"}>
                                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Run Tests Button */}
                <button
                    onClick={runTests}
                    disabled={testing}
                    className="btn-gold w-full text-lg py-4 flex items-center justify-center gap-2 mb-8"
                >
                    {testing ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Testing Connection...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-5 w-5" />
                            Run Connection Tests
                        </>
                    )}
                </button>

                {/* Results */}
                {results.length > 0 && (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="luxury-card text-center">
                                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-green-400">{successCount}</p>
                                <p className="text-luxury-white/60 text-sm">Passed</p>
                            </div>
                            <div className="luxury-card text-center">
                                <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                                <p className="text-luxury-white/60 text-sm">Failed</p>
                            </div>
                        </div>

                        {/* Detailed Results */}
                        <div className="space-y-3">
                            {results.map((result, idx) => (
                                <div
                                    key={idx}
                                    className={`luxury-card border-l-4 ${result.status === "success"
                                        ? "border-l-green-500"
                                        : result.status === "error"
                                            ? "border-l-red-500"
                                            : "border-l-yellow-500"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {result.status === "success" ? (
                                            <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                                        ) : result.status === "error" ? (
                                            <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                                        ) : (
                                            <Loader2 className="h-5 w-5 text-yellow-400 animate-spin mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                            <h3 className="text-luxury-white font-medium">{result.name}</h3>
                                            <p className="text-luxury-white/60 text-sm mt-1">{result.message}</p>
                                            {result.data && result.data.length > 0 && (
                                                <div className="mt-2 p-2 bg-luxury-gray/50 rounded text-xs text-luxury-white/70 overflow-x-auto">
                                                    <pre>{JSON.stringify(result.data, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Help Section */}
                <div className="mt-8 luxury-card bg-gold/10 border-gold/30">
                    <h3 className="text-gold font-semibold mb-2">⚠️ إذا فشل الاختبار:</h3>
                    <ol className="list-decimal list-inside text-luxury-white/80 text-sm space-y-2">
                        <li>تأكد من وضع بيانات Supabase في ملف <code className="text-gold">.env.local</code></li>
                        <li>شغّل ملف <code className="text-gold">schema.sql</code> في SQL Editor</li>
                        <li>أنشئ الـ Storage Bucket باسم <code className="text-gold">car-images</code></li>
                        <li>أعد تشغيل الخادم بعد تعديل <code className="text-gold">.env.local</code></li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
