"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
// Navbar is provided by admin layout
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import {
  adminGetBookingRequests,
  adminUpdateBookingRequest,
  type BookingRequestStatus,
  type BookingRequestType
} from "@/lib/api";

type RequestRow = {
  id: string;
  type: BookingRequestType;
  status: BookingRequestStatus;
  message?: string | null;
  responseMessage?: string | null;
  customerResponse?: string | null;
  customerRespondedAt?: string | null;
  messages?: { id: string; actor: "ADMIN" | "CUSTOMER"; message: string; createdAt: string }[];
  createdAt: string;
  booking: {
    id: string;
    bookingCode?: string | null;
    guestName: string;
    guestPhone: string;
    guestEmail?: string | null;
    checkIn: string;
    checkOut: string;
    unit?: { number: number; floor: number } | null;
    unitType?: { nameAr: string; nameEn: string } | null;
  };
};

function AdminRequestsContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingRequestStatus>("all");
  const [statusEdits, setStatusEdits] = useState<Record<string, BookingRequestStatus>>({});
  const [responseEdits, setResponseEdits] = useState<Record<string, string>>({});

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
      const data = await adminGetBookingRequests(t);
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  const canManageRequests = isSuperAdmin || permissions.includes("requests:manage");
  const canManageUsers = isSuperAdmin || permissions.includes("users:manage");

  useEffect(() => {
    if (token && canManageRequests) load(token);
  }, [token, canManageRequests]);

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  const statusLabel = (status: BookingRequestStatus) => {
    switch (status) {
      case "PENDING":
        return m.requestStatusPending;
      case "AWAITING_CUSTOMER":
        return m.requestStatusAwaitingCustomer;
      case "APPROVED":
        return m.requestStatusApproved;
      case "REJECTED":
        return m.requestStatusRejected;
      default:
        return status;
    }
  };

  const typeLabel = (type: BookingRequestType) => {
    switch (type) {
      case "UPGRADE":
        return m.requestTypeUpgrade;
      case "EARLY_CHECKIN":
        return m.requestTypeEarlyCheckin;
      case "LATE_CHECKOUT":
        return m.requestTypeLateCheckout;
      case "OTHER":
        return m.requestTypeOther;
      default:
        return type;
    }
  };

  const actorLabel = (actor: "ADMIN" | "CUSTOMER") => (actor === "ADMIN" ? m.adminLabel : m.customerLabel);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const target = [
        r.id,
        r.type,
        r.status,
        r.message || "",
        r.responseMessage || "",
        r.booking?.id,
        r.booking?.guestName,
        r.booking?.guestPhone,
        r.booking?.guestEmail || ""
      ].join(" ").toLowerCase();
      return target.includes(q);
    });
  }, [rows, search, statusFilter]);

  async function saveRequest(row: RequestRow) {
    if (!token || !canManageRequests) return;
    setSavingId(row.id);
    setError(null);
    const status = statusEdits[row.id] ?? row.status;
    const responseMessage = responseEdits[row.id] ?? row.responseMessage ?? "";
    try {
      await adminUpdateBookingRequest(token, row.id, {
        status,
        responseMessage: responseMessage.trim() ? responseMessage : null
      });
      await load(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSavingId(null);
    }
  }

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  };

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!canManageRequests ? (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-800 text-sm">
            {m.noPermission}
          </div>
        ) : null}

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        {canManageRequests ? (
        <div className="rounded-3xl bg-white border shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <label className="text-sm text-gray-700">
              {m.searchRequests}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={m.requestSearchPlaceholder}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
              />
            </label>
            <label className="text-sm text-gray-700">
              {m.requestStatus}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
              >
                <option value="all">{m.all}</option>
                <option value="PENDING">{m.requestStatusPending}</option>
                <option value="AWAITING_CUSTOMER">{m.requestStatusAwaitingCustomer}</option>
                <option value="APPROVED">{m.requestStatusApproved}</option>
                <option value="REJECTED">{m.requestStatusRejected}</option>
              </select>
            </label>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            {m.showing} {filteredRows.length} / {rows.length}
          </div>
        </div>
        ) : null}

        {canManageRequests ? (
        <div className="rounded-3xl bg-white border shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-bg border-b">
                <tr className="text-gray-700">
                  <th className="p-3 text-left">{m.bookingId}</th>
                  <th className="p-3 text-left">{locale === "ar" ? "العميل" : "Guest"}</th>
                  <th className="p-3 text-left">{locale === "ar" ? "التواريخ" : "Dates"}</th>
                  <th className="p-3 text-left">{m.requestType}</th>
                  <th className="p-3 text-left">{m.requestStatus}</th>
                  <th className="p-3 text-left">{m.responseMessage}</th>
                  <th className="p-3 text-left">{m.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const statusValue = statusEdits[r.id] ?? r.status;
                  const responseValue = responseEdits[r.id] ?? r.responseMessage ?? "";
                  const unitName = locale === "ar" ? r.booking?.unitType?.nameAr : r.booking?.unitType?.nameEn;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-mono text-xs">{r.booking?.bookingCode || r.booking?.id || r.id}</div>
                        {r.booking?.bookingCode ? (
                          <div className="text-[10px] text-gray-500">{r.booking.id}</div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-primary">{r.booking?.guestName}</div>
                        <div className="text-xs text-gray-600">{r.booking?.guestPhone}</div>
                        {r.booking?.guestEmail ? (
                          <div className="text-xs text-gray-500">{r.booking.guestEmail}</div>
                        ) : null}
                        {unitName ? (
                          <div className="text-xs text-gray-500">{unitName}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-xs text-gray-700">
                        {formatDate(r.booking?.checkIn)} → {formatDate(r.booking?.checkOut)}
                      </td>
                    <td className="p-3">
                      <div className="font-semibold">{typeLabel(r.type)}</div>
                      <div className="text-xs text-gray-600">{r.message || "—"}</div>
                      {r.messages?.length ? (
                        <div className="mt-2 space-y-1">
                          {r.messages.map((msg) => (
                            <div key={msg.id} className="text-[11px] text-gray-600">
                              <span className="font-semibold">{actorLabel(msg.actor)}:</span> {msg.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        r.customerResponse ? (
                          <div className="mt-2 text-[11px] text-emerald-700">
                            {m.customerResponseLabel}: {r.customerResponse}
                          </div>
                        ) : null
                      )}
                    </td>
                      <td className="p-3">
                        <select
                          value={statusValue}
                          onChange={(e) => setStatusEdits((prev) => ({ ...prev, [r.id]: e.target.value as BookingRequestStatus }))}
                          className="px-3 py-2 rounded-xl border text-xs bg-white"
                        >
                          <option value="PENDING">{m.requestStatusPending}</option>
                          <option value="AWAITING_CUSTOMER">{m.requestStatusAwaitingCustomer}</option>
                          <option value="APPROVED">{m.requestStatusApproved}</option>
                          <option value="REJECTED">{m.requestStatusRejected}</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <textarea
                          value={responseValue}
                          onChange={(e) => setResponseEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="w-60 px-3 py-2 rounded-xl border text-xs"
                          rows={2}
                          placeholder={m.responseMessage}
                        />
                      </td>
                      <td className="p-3">
                        <button
                          disabled={savingId === r.id}
                          onClick={() => saveRequest(r)}
                          className="px-3 py-2 rounded-xl bg-primary text-white text-xs"
                        >
                          {savingId === r.id ? m.saving : m.save}
                        </button>
                        <div className="mt-2 text-[10px] text-gray-500">{statusLabel(statusValue)}</div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-gray-600" colSpan={7}>
                      {locale === "ar" ? "لا توجد طلبات بعد" : "No requests yet"}
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

export default function AdminRequests() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminRequestsContent />
    </Suspense>
  );
}
