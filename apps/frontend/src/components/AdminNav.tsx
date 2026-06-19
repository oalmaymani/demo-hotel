"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";

export default function AdminNav() {
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

  const showAdminNav = !pathname?.includes("/admin/login");

  return (
    <div>
      <Navbar brand={m.brand} locale={locale} />
      {showAdminNav ? (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 rounded-xl bg-primary text-white text-sm">{m.admin}</span>
              {(
                [
                  { href: "/admin/bookings", label: m.bookings },
                  { href: "/admin/requests", label: m.customerRequests },
                  { href: "/admin/availability", label: m.availability },
                  { href: "/admin/calendar", label: m.calendar },
                  { href: "/admin/loyalty", label: locale === "ar" ? "الولاء" : "Loyalty" },
                  { href: "/admin/users", label: m.users },
                ] as { href: string; label: string }[]
              )
                .filter((it) => !(pathname ?? "").startsWith(it.href))
                .map((it) => (
                  <Link key={it.href} href={`${it.href}?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                    {it.label}
                  </Link>
                ))}
            </div>
            <button onClick={logout} className="px-4 py-2 rounded-xl border hover:bg-bg text-sm">
              {m.logout}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
