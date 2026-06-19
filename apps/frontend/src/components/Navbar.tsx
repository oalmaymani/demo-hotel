"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function Navbar({ brand, locale }: { brand: string; locale: "ar" | "en" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isAdminPage = pathname?.startsWith("/admin");

  function toggleLocale() {
    const next = locale === "ar" ? "en" : "ar";
    const q = new URLSearchParams(sp.toString());
    q.set("lang", next);
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href={`/?lang=${locale}`} className="font-bold text-lg text-primary">
          {brand}
        </Link>
        <div className="flex items-center gap-3">
          {!isAdminPage ? (
            <Link href={`/my-bookings?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
              {locale === "ar" ? "حجوزاتي" : "My bookings"}
            </Link>
          ) : null}
          <button
            onClick={toggleLocale}
            className="px-3 py-2 rounded-xl border hover:bg-bg text-sm"
            aria-label="Toggle language"
          >
            {locale === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </div>
    </div>
  );
}
