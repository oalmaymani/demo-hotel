"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
// Navbar is provided by admin layout
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { adminGetAvailableUnits, adminGetBookings, adminGetUnitTypes, adminSetBookingStatus, adminSetBookingUnit, type BookingStatus } from "@/lib/api";

function AdminBookingsContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unitOptions, setUnitOptions] = useState<Record<string, { id: string; number: number; floor: number }[]>>({});
  const [unitLoading, setUnitLoading] = useState<Record<string, boolean>>({});
  const [unitSavingId, setUnitSavingId] = useState<string | null>(null);
  const [unitSelection, setUnitSelection] = useState<Record<string, string>>({});
  const [unitEditOpen, setUnitEditOpen] = useState<Record<string, boolean>>({});
  const [unitTypes, setUnitTypes] = useState<any[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState<Record<string, boolean>>({});
  const [unitTypeSelection, setUnitTypeSelection] = useState<Record<string, string>>({});

  const [bookingSearch, setBookingSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromCheckIn, setFromCheckIn] = useState("");
  const [toCheckIn, setToCheckIn] = useState("");
  const [bookingSort, setBookingSort] = useState<"dateAsc" | "dateDesc" | "status">("dateDesc");

  useEffect(() => {
    const t = localStorage.getItem("towseasons_admin_token");
    if (!t) {
      router.push(`/admin/login?lang=${locale}`);
      return;
    }
    const rawPerms = localStorage.getItem("towseasons_admin_perms");
    if (rawPerms) {
      try {
        setPermissions(JSON.parse(rawPerms));
      } catch {
        setPermissions([]);
      }
    } else {
      setPermissions([]);
    }
    setIsSuperAdmin(localStorage.getItem("towseasons_admin_super") === "true");
    setToken(t);
  }, [locale, router]);

  async function load(t: string) {
    setError(null);
    try {
      const [data, types] = await Promise.all([
        adminGetBookings(t),
        adminGetUnitTypes(t).catch(() => [])
      ]);
      setRows(data);
      setUnitTypes(types);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  const canView = isSuperAdmin || permissions.includes("bookings:view");
  const canStatus = isSuperAdmin || permissions.includes("bookings:status");
  const canUnit = isSuperAdmin || permissions.includes("bookings:unit");
  const canManageUsers = isSuperAdmin || permissions.includes("users:manage");

  useEffect(() => {
    if (token && canView) load(token);
  }, [token, canView]);

  const kpis = useMemo(() => {
    const today = new Date();
    const y = today.getUTCFullYear(), mth = today.getUTCMonth(), d = today.getUTCDate();
    const start = Date.UTC(y, mth, d, 0, 0, 0);
    const end = Date.UTC(y, mth, d + 1, 0, 0, 0);
    const todayCount = rows.filter(r => {
      const t = new Date(r.createdAt).getTime();
      return t >= start && t < end;
    }).length;
    const pendingCount = rows.filter(r => r.status === "PENDING").length;
    return { todayCount, total: rows.length, pendingCount };
  }, [rows]);

  const typeOptions = useMemo(() => {
    const map = new Map<string, { key: string; labelAr: string; labelEn: string }>();
    for (const r of rows) {
      const key = r.unitType.nameEn;
      if (!map.has(key)) {
        map.set(key, { key, labelAr: r.unitType.nameAr, labelEn: r.unitType.nameEn });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.labelEn.localeCompare(b.labelEn));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.unitType.nameEn !== typeFilter) return false;
      if (fromCheckIn && new Date(r.checkIn) < new Date(fromCheckIn)) return false;
      if (toCheckIn && new Date(r.checkIn) > new Date(toCheckIn)) return false;
      if (!q) return true;
      const target = `${r.guestName} ${r.guestPhone} ${r.unit?.number || ""}`.toLowerCase();
      return target.includes(q);
    });
  }, [rows, bookingSearch, statusFilter, typeFilter, fromCheckIn, toCheckIn]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      switch (bookingSort) {
        case "dateAsc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "dateDesc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "status": {
          const statusOrder: Record<BookingStatus, number> = {
            PENDING: 0,
            CONFIRMED: 1,
            CANCELLED: 2,
            COMPLETED: 3,
            NO_SHOW: 4
          };
          return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        default:
          return 0;
      }
    });
    return list;
  }, [filteredRows, bookingSort]);

  const floorTag = (floor: number) => (locale === "ar" ? `${m.floor} ${floor}` : `F${floor}`);

  function statusLabel(status: BookingStatus) {
    switch (status) {
      case "PENDING":
        return m.pending;
      case "CONFIRMED":
        return m.confirmed;
      case "CANCELLED":
        return m.cancelled;
      case "COMPLETED":
        return m.completed;
      case "NO_SHOW":
        return m.noShow;
      default:
        return status;
    }
  }

  async function setStatus(id: string, status: BookingStatus) {
    if (!token || !canStatus) return;
    await adminSetBookingStatus(token, id, status);
    await load(token);
  }

  async function loadAvailableUnits(bookingId: string, unitTypeId?: string) {
    if (!token || !canUnit) return;
    setUnitLoading((prev) => ({ ...prev, [bookingId]: true }));
    setError(null);
    try {
      const data = await adminGetAvailableUnits(token, bookingId, unitTypeId);
      setUnitOptions((prev) => ({ ...prev, [bookingId]: data.units || [] }));
      if (data.currentUnitId) {
        setUnitSelection((prev) => ({ ...prev, [bookingId]: data.currentUnitId }));
      }
      setUnitEditOpen((prev) => ({ ...prev, [bookingId]: true }));
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUnitLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  async function saveUnit(bookingId: string) {
    if (!token || !canUnit) return;
    const unitId = unitSelection[bookingId] || unitOptions[bookingId]?.[0]?.id;
    if (!unitId) {
      setError(locale === "ar" ? "اختر وحدة أولاً" : "Select a unit first");
      return;
    }
    setUnitSavingId(bookingId);
    setError(null);
    try {
      const updated = await adminSetBookingUnit(token, bookingId, unitId);
      setRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, ...updated } : r)));
      setUnitEditOpen((prev) => ({ ...prev, [bookingId]: false }));
      await load(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUnitSavingId(null);
    }
  }

  async function autoAssign(bookingId: string, unitTypeId?: string) {
    if (!token || !canUnit) return;
    setUnitLoading((prev) => ({ ...prev, [bookingId]: true }));
    setError(null);
    try {
      const data = await adminGetAvailableUnits(token, bookingId, unitTypeId);
      const first = data.units?.[0];
      if (!first) {
        setError(locale === "ar" ? "لا توجد وحدات متاحة" : "No available units");
        return;
      }
      await adminSetBookingUnit(token, bookingId, first.id);
      setUnitEditOpen((prev) => ({ ...prev, [bookingId]: false }));
      await load(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUnitLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  function toggleUpgradeOptions(bookingId: string, currentTypeId: string) {
    setUpgradeOpen((prev) => {
      const next = !prev[bookingId];
      if (next) {
        setUnitTypeSelection((sel) => ({ ...sel, [bookingId]: sel[bookingId] || currentTypeId }));
      }
      return { ...prev, [bookingId]: next };
    });
  }

  function handleUnitTypeChange(bookingId: string, nextTypeId: string) {
    setUnitTypeSelection((prev) => ({ ...prev, [bookingId]: nextTypeId }));
    setUnitSelection((prev) => ({ ...prev, [bookingId]: "" }));
    loadAvailableUnits(bookingId, nextTypeId);
  }

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-white border shadow-sm p-4">
            <div className="text-sm text-gray-600">{locale === "ar" ? "حجوزات اليوم" : "Today bookings"}</div>
            <div className="text-3xl font-extrabold text-primary">{kpis.todayCount}</div>
          </div>
          <div className="rounded-2xl bg-white border shadow-sm p-4">
            <div className="text-sm text-gray-600">{locale === "ar" ? "إجمالي الحجوزات" : "Total bookings"}</div>
            <div className="text-3xl font-extrabold text-primary">{kpis.total}</div>
          </div>
        </div>

        {kpis.pendingCount > 0 ? (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-800 text-sm">
            {m.pendingAlert}: {kpis.pendingCount}
          </div>
        ) : null}

        {!canView ? (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-800 text-sm">
            {m.noPermission}
          </div>
        ) : null}

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        {canView ? (
        <div className="rounded-3xl bg-white border shadow-sm p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <label className="text-sm text-gray-700">
              {m.searchBookings}
              <input
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                placeholder={m.bookingSearchPlaceholder}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
              />
            </label>
            <label className="text-sm text-gray-700">
              {m.status}
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="all">{m.all}</option>
                <option value="PENDING">{m.pending}</option>
                <option value="CONFIRMED">{m.confirmed}</option>
                <option value="CANCELLED">{m.cancelled}</option>
                <option value="COMPLETED">{m.completed}</option>
                <option value="NO_SHOW">{m.noShow}</option>
              </select>
            </label>
            <label className="text-sm text-gray-700">
              {m.type}
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="all">{m.all}</option>
                {typeOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {locale === "ar" ? t.labelAr : t.labelEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              {m.fromCheckIn}
              <input type="date" dir="ltr" value={fromCheckIn} onChange={(e) => setFromCheckIn(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-xl border ${isRTL(locale) ? "text-right" : "text-left"}`} />
            </label>
            <label className="text-sm text-gray-700">
              {m.toCheckIn}
              <input type="date" dir="ltr" value={toCheckIn} onChange={(e) => setToCheckIn(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-xl border ${isRTL(locale) ? "text-right" : "text-left"}`} />
            </label>
            <label className="text-sm text-gray-700">
              {m.sortBy}
              <select value={bookingSort} onChange={(e) => setBookingSort(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                <option value="dateDesc">{m.sortDateDesc}</option>
                <option value="dateAsc">{m.sortDateAsc}</option>
                <option value="status">{m.sortStatus}</option>
              </select>
            </label>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            {m.showing} {sortedRows.length} / {rows.length}
          </div>
        </div>
        ) : null}

        {canView ? (
        <div className="rounded-3xl bg-white border shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-bg border-b">
                <tr className="text-gray-700">
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">{locale === "ar" ? "العميل" : "Guest"}</th>
                  <th className="p-3 text-left">{m.phone}</th>
                  <th className="p-3 text-left">{locale === "ar" ? "الوحدة" : "Unit"}</th>
                  <th className="p-3 text-left">{locale === "ar" ? "التواريخ" : "Dates"}</th>
                  <th className="p-3 text-left">{m.status}</th>
                  <th className="p-3 text-left">{locale === "ar" ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-mono text-xs">{r.bookingCode || r.id}</div>
                      {r.bookingCode ? (
                        <div className="text-[10px] text-gray-500">{r.id}</div>
                      ) : null}
                    </td>
                    <td className="p-3">{r.guestName}</td>
                    <td className="p-3">{r.guestPhone}</td>
                    <td className="p-3">
                      <div className="font-semibold text-primary">{locale === "ar" ? r.unitType.nameAr : r.unitType.nameEn}</div>
                      <div className="text-xs text-gray-600">
                        {r.unit ? `#${r.unit.number} (${floorTag(r.unit.floor)})` : (locale === "ar" ? "غير محددة" : "Unassigned")}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {!unitEditOpen[r.id] ? (
                          <>
                            {canUnit ? (
                              <>
                                <button
                                  onClick={() => loadAvailableUnits(r.id, unitTypeSelection[r.id] || r.unitTypeId)}
                                  className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
                                  disabled={unitLoading[r.id]}
                                >
                                  {unitLoading[r.id] ? (locale === "ar" ? "جارٍ التحميل..." : "Loading...") : (locale === "ar" ? "تغيير الوحدة" : "Change unit")}
                                </button>
                                <button
                                  onClick={() => autoAssign(r.id, unitTypeSelection[r.id] || r.unitTypeId)}
                                  className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
                                  disabled={unitLoading[r.id]}
                                >
                                  {m.autoAssign}
                                </button>
                              </>
                            ) : (
                              <div className="text-[11px] text-gray-500">
                                {m.noPermissionUnit}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <select
                              value={unitSelection[r.id] || r.unit?.id || ""}
                              onChange={(e) => setUnitSelection((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              className="px-2 py-1 rounded-xl border text-xs"
                            >
                              {!unitSelection[r.id] && !r.unit?.id ? (
                                <option value="" disabled>
                                  {locale === "ar" ? "اختر وحدة" : "Select unit"}
                                </option>
                              ) : null}
                              {unitOptions[r.id]?.map((u) => (
                                <option key={u.id} value={u.id}>
                                  #{u.number} ({floorTag(u.floor)})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => saveUnit(r.id)}
                              disabled={unitSavingId === r.id}
                              className="px-3 py-1 rounded-xl bg-primary text-white text-xs"
                            >
                              {unitSavingId === r.id ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ" : "Save")}
                            </button>
                            <button
                              onClick={() => setUnitEditOpen((prev) => ({ ...prev, [r.id]: false }))}
                              className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
                              disabled={unitSavingId === r.id}
                            >
                              {locale === "ar" ? "إغلاق" : "Close"}
                            </button>
                          </>
                        )}
                      </div>
                      {unitEditOpen[r.id] && Array.isArray(r.requests) && r.requests.length ? (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleUpgradeOptions(r.id, r.unitTypeId)}
                            className="text-[11px] text-gray-500 underline"
                          >
                            {upgradeOpen[r.id] ? (locale === "ar" ? "إخفاء الترقية" : "Hide upgrade") : m.upgradeOptions}
                          </button>
                          {upgradeOpen[r.id] ? (
                            <div className="mt-2">
                              <select
                                value={unitTypeSelection[r.id] || r.unitTypeId}
                                onChange={(e) => handleUnitTypeChange(r.id, e.target.value)}
                                className="px-2 py-1 rounded-xl border text-xs bg-white"
                              >
                                {unitTypes.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {locale === "ar" ? t.nameAr : t.nameEn}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <div className="text-xs text-gray-700">{new Date(r.checkIn).toISOString().slice(0,10)} → {new Date(r.checkOut).toISOString().slice(0,10)}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-full border bg-bg text-xs">
                        {statusLabel(r.status)}
                      </span>
                      {r.discountPercent ? (
                        <div className="mt-2 text-[11px] text-emerald-700">
                          {m.discountApplied} {r.discountPercent}%{r.discountAmount ? ` (${r.discountAmount} ${m.sar})` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <select
                        value={r.status}
                        onChange={(e) => setStatus(r.id, e.target.value as BookingStatus)}
                        className={`px-3 py-1 rounded-xl border text-xs bg-white hover:bg-bg ${!canStatus ? "opacity-60 cursor-not-allowed" : ""}`}
                        aria-label={locale === "ar" ? "تغيير الحالة" : "Change status"}
                        disabled={!canStatus}
                      >
                        <option value="PENDING">{m.pending}</option>
                        <option value="CONFIRMED">{m.confirmed}</option>
                        <option value="CANCELLED">{m.cancelled}</option>
                        <option value="COMPLETED">{m.completed}</option>
                        <option value="NO_SHOW">{m.noShow}</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-gray-600" colSpan={7}>
                      {locale === "ar" ? "لا توجد حجوزات بعد" : "No bookings yet"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminBookings() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminBookingsContent />
    </Suspense>
  );
}
