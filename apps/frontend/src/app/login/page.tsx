'use client';

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, testAccounts } from "@/providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyTestAccount = (accountEmail: string, accountPassword: string) => {
    setEmail(accountEmail);
    setPassword(accountPassword);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-white to-white px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/mentra-wordmark.png" alt="Mentra" width={200} height={60} priority className="h-auto w-48" />
          <h1 className="text-3xl font-semibold text-neutral-900">Sign in to Mentra</h1>
          <p className="mt-1 text-sm text-neutral-500">Use one of the prepared demo accounts to explore the manual.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="admin@mentra.dev"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-neutral-700">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="••••••••"
              required
            />
          </label>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Demo accounts</h2>
          <ul className="mt-3 space-y-3 text-sm text-neutral-600">
            {testAccounts.map(account => (
              <li key={account.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <div>
                  <p className="font-medium text-neutral-800">{account.name}</p>
                  <p className="text-xs text-neutral-500">{account.email}</p>
                  <p className="text-xs text-neutral-500">Password: {account.password}</p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTestAccount(account.email, account.password)}
                  className="rounded-full border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                >
                  Autofill
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to manual
          </Link>
        </div>
      </div>
    </div>
  );
}
