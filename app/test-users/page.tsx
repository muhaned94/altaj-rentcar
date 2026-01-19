"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestUsersPage() {
    const [data, setData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState<any>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginStatus, setLoginStatus] = useState("");

    async function checkStatus() {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        const { data, error } = await supabase.from("employees").select("*");
        setData(data);
        setError(error);
    }

    useEffect(() => {
        checkStatus();
    }, []);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginStatus("Logging in...");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setLoginStatus("Error: " + error.message);
        } else {
            setLoginStatus("Success!");
            checkStatus();
        }
    }

    return (
        <div className="p-8 bg-white text-black font-sans">
            <h1 className="text-2xl font-bold mb-4">Debug & Login Page</h1>

            <section className="mb-8 p-4 border border-blue-500 rounded">
                <h2 className="text-xl font-semibold mb-2">Login to Test</h2>
                <form onSubmit={handleLogin} className="flex flex-col gap-2 max-w-sm">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="border p-2"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="border p-2"
                    />
                    <button type="submit" className="bg-blue-500 text-white p-2 rounded">Login</button>
                    {loginStatus && <p>{loginStatus}</p>}
                </form>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-semibold">Current Auth User</h2>
                {user ? (
                    <pre className="bg-gray-100 p-4 rounded mt-2">
                        {JSON.stringify({
                            id: user.id,
                            email: user.email,
                            role: user.role
                        }, null, 2)}
                    </pre>
                ) : (
                    <p className="text-yellow-600 font-bold">No user logged in (Anonymous)</p>
                )}
            </section>

            <section>
                <h2 className="text-xl font-semibold">Employees Table (Visible to current session)</h2>
                {error && (
                    <div className="bg-red-100 p-4 rounded mt-2 text-red-700">
                        <p className="font-bold">Error:</p>
                        <pre>{JSON.stringify(error, null, 2)}</pre>
                    </div>
                )}
                {data ? (
                    <div className="mt-4">
                        <p className="font-bold mb-2">Rows found: {data.length}</p>
                        {data.length > 0 ? (
                            <pre className="bg-gray-100 p-4 rounded mt-2 text-xs">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        ) : (
                            <p className="p-4 bg-gray-50 border border-dashed rounded text-gray-500">
                                The table returned 0 rows. This means either:
                                1. The table is actually empty.
                                2. RLS is ON and you don't have permission to see any rows.
                            </p>
                        )}
                    </div>
                ) : (
                    <p>Loading data...</p>
                )}
            </section>

            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    checkStatus();
                }}
                className="mt-8 text-red-600 underline"
            >
                Log Out
            </button>
        </div>
    );
}
