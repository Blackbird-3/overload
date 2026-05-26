"use client";

import { useState } from "react";
import { account } from "@/lib/appwrite";
import { ID } from "appwrite";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, checkSession } = useAuth();

  // Auto-redirect if already logged in
  if (user) {
    router.push("/dashboard");
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await account.create(ID.unique(), email, password, name);
      await account.createEmailPasswordSession(email, password);
      await checkSession();
      router.push("/dashboard");
    } catch (err: any) {
      if (err.message && err.message.includes("session is active")) {
        try {
          await account.deleteSession("current");
          await account.createEmailPasswordSession(email, password);
          await checkSession();
          router.push("/dashboard");
        } catch (retryErr: any) {
          setError(retryErr.message || "Failed to login after signup");
        }
      } else {
        setError(err.message || "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white/5 p-8 shadow-2xl backdrop-blur-xl border border-white/10">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Start tracking your progressive overload
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="sr-only" htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="relative block w-full rounded-lg border-0 bg-white/5 py-3 px-4 text-white placeholder-gray-400 ring-1 ring-inset ring-white/10 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="email-address">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-lg border-0 bg-white/5 py-3 px-4 text-white placeholder-gray-400 ring-1 ring-inset ring-white/10 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="relative block w-full rounded-lg border-0 bg-white/5 py-3 px-4 text-white placeholder-gray-400 ring-1 ring-inset ring-white/10 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                placeholder="Password (min. 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 py-3 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign up"
              )}
            </button>
          </div>
        </form>
        <div className="text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold leading-6 text-blue-500 hover:text-blue-400 transition-colors">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
