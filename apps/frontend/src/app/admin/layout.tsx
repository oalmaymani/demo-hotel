"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale: Locale = sp?.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);

  React.useEffect(() => {
    const rawPerms = localStorage.getItem("towseasons_admin_perms");
    if (rawPerms) {
      try {
        setPermissions(JSON.parse(rawPerms));
      } catch {
        setPermissions([]);
      }
    }
    setIsSuperAdmin(localStorage.getItem("towseasons_admin_super") === "true");
  }, []);

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  const canManageUsers = isSuperAdmin || permissions.includes("users:manage");
  const showAdminNav = !pathname?.includes("/admin/login");

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      {showAdminNav ? (
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 rounded-xl bg-primary text-white text-sm">{m.admin}</span>
              <Link href={`/admin/bookings?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.bookings}
              </Link>
              <Link href={`/admin/requests?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.customerRequests}
              </Link>
              <Link href={`/admin/availability?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.availability}
              </Link>
              <Link href={`/admin/calendar?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.calendar}
              </Link>
              <Link href={`/admin/loyalty?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {locale === "ar" ? "الولاء" : "Loyalty"}
              </Link>
              {canManageUsers ? (
                <Link href={`/admin/users?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                  {m.users}
                </Link>
              ) : null}
            </div>
            <button onClick={logout} className="px-4 py-2 rounded-xl border hover:bg-bg text-sm">
              {m.logout}
            </button>
          </div>
          {children}
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      )}
    </div>
  );
}
