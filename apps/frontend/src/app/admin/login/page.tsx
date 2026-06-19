"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// Navbar is provided by admin layout
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { adminLogin } from "@/lib/api";

function AdminLoginContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, permissions, isSuperAdmin } = await adminLogin(email, password);
      localStorage.setItem("towseasons_admin_token", token);
      localStorage.setItem("towseasons_admin_perms", JSON.stringify(permissions || []));
      localStorage.setItem("towseasons_admin_super", isSuperAdmin ? "true" : "false");
      router.push(`/admin/bookings?lang=${locale}`);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-3xl bg-white border shadow-sm p-6">
          <h1 className="text-2xl font-bold text-primary mb-4">{m.login}</h1>
          {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}
          <form onSubmit={submit} className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 rounded-xl border" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.password}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2 rounded-xl border" />
            </label>
            <button disabled={loading} className="px-5 py-3 rounded-2xl bg-primary text-white font-semibold">
              {loading ? (locale === "ar" ? "جارٍ..." : "Loading...") : m.login}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminLoginContent />
    </Suspense>
  );
}
