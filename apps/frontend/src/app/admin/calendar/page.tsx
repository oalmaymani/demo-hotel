"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { adminGetBlocks, adminGetBookings, adminGetUnits } from "@/lib/api";

function AdminCalendarContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [token, setToken] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("towseasons_admin_token");
    if (!t) {
      router.push(`/admin/login?lang=${locale}`);
      return;
    }
    setToken(t);
  }, [locale, router]);

  async function loadAll(t: string) {
    setError(null);
    try {
      const [u, b, bl] = await Promise.all([adminGetUnits(t), adminGetBookings(t), adminGetBlocks(t)]);
      setUnits(u);
      setBookings(b);
      setBlocks(bl);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  useEffect(() => {
    if (token) loadAll(token);
  }, [token]);

  const days = useMemo(() => {
    const out: Date[] = [];
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getTime());
      d.setUTCDate(start.getUTCDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const dayKeys = useMemo(() => days.map((d) => d.toISOString().slice(0, 10)), [days]);

  const occupancy = useMemo(() => {
    const booked = new Map<string, Set<string>>();
    const blocked = new Map<string, Set<string>>();

    function mark(map: Map<string, Set<string>>, unitId: string, start: Date, end: Date) {
      const set = map.get(unitId) || new Set<string>();
      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        if (d >= start && d < end) {
          set.add(dayKeys[i]);
        }
      }
      map.set(unitId, set);
    }

    for (const b of bookings) {
      if (b.status !== "PENDING" && b.status !== "CONFIRMED") continue;
      const unitId = b.unit?.id;
      if (!unitId) continue;
      mark(booked, unitId, new Date(b.checkIn), new Date(b.checkOut));
    }

    for (const bl of blocks) {
      const unitId = bl.unit?.id;
      if (!unitId) continue;
      mark(blocked, unitId, new Date(bl.startDate), new Date(bl.endDate));
    }

    return { booked, blocked };
  }, [bookings, blocks, days, dayKeys]);

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.number - b.number);
  }, [units]);

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-xl bg-primary text-white text-sm">{m.calendarTitle}</span>
            <Link href={`/admin/bookings?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
              {m.bookings}
            </Link>
            <Link href={`/admin/requests?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
              {m.customerRequests}
            </Link>
            <Link href={`/admin/availability?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
              {m.availability}
            </Link>
            <Link href={`/admin/users?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
              {m.users}
            </Link>
          </div>
          <button onClick={logout} className="px-4 py-2 rounded-xl border hover:bg-bg text-sm">
            {m.logout}
          </button>
        </div>

        <div className="rounded-2xl bg-white border shadow-sm p-4 mb-4">
          <div className="text-sm font-semibold text-primary mb-2">{m.legend}</div>
          <div className="flex items-center gap-4 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-emerald-200 inline-block" />
              {m.available}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-amber-300 inline-block" />
              {m.blocked}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-red-400 inline-block" />
              {m.booked}
            </div>
          </div>
        </div>

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        <div className="rounded-3xl bg-white border shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <div className="min-w-[900px]">
              <div className="flex border-b bg-bg text-xs text-gray-600">
                <div className="w-32 p-2 font-semibold">{m.unit}</div>
                {days.map((d, idx) => (
                  <div key={dayKeys[idx]} className="w-7 p-2 text-center">
                    {d.getUTCDate()}
                  </div>
                ))}
              </div>
              {sortedUnits.map((u) => {
                const bookedSet = occupancy.booked.get(u.id) || new Set<string>();
                const blockedSet = occupancy.blocked.get(u.id) || new Set<string>();
                return (
                  <div key={u.id} className="flex border-b last:border-0">
                    <div className="w-32 p-2 text-xs text-gray-700">
                      #{u.number}
                      <div className="text-[10px] text-gray-500">{m.floor} {u.floor}</div>
                    </div>
                    {dayKeys.map((key) => {
                      const isBooked = bookedSet.has(key);
                      const isBlocked = blockedSet.has(key);
                      const color = isBooked ? "bg-red-400" : isBlocked ? "bg-amber-300" : "bg-emerald-200";
                      return <div key={`${u.id}-${key}`} className={`w-7 h-7 border-l ${color}`} />;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminCalendar() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminCalendarContent />
    </Suspense>
  );
}
