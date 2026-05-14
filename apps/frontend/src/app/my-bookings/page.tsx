"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import {
  publicCreateBookingRequest,
  publicLookupBooking,
  publicRespondToBookingRequest,
  type BookingRequestStatus,
  type BookingRequestType
} from "@/lib/api";

type LookupResult = {
  booking: any;
  requests: any[];
};

function MyBookingsContent() {
  const sp = useSearchParams();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [bookingId, setBookingId] = useState(sp.get("bookingId") || "");
  const [identifier, setIdentifier] = useState(sp.get("identifier") || "");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestType, setRequestType] = useState<BookingRequestType>("UPGRADE");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [replyEdits, setReplyEdits] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);

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

  const actorLabel = (actor: "ADMIN" | "CUSTOMER") => (actor === "ADMIN" ? m.adminLabel : m.customerLabel);

  const typeOptions = useMemo(
    () => [
      { value: "UPGRADE" as BookingRequestType, label: m.requestTypeUpgrade },
      { value: "EARLY_CHECKIN" as BookingRequestType, label: m.requestTypeEarlyCheckin },
      { value: "LATE_CHECKOUT" as BookingRequestType, label: m.requestTypeLateCheckout },
      { value: "OTHER" as BookingRequestType, label: m.requestTypeOther }
    ],
    [m]
  );

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  };

  async function handleLookup(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const data = await publicLookupBooking({ bookingId: bookingId.trim(), identifier: identifier.trim() });
      setResult(data);
    } catch (err: any) {
      setError(m.bookingNotFound);
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(e: any) {
    e.preventDefault();
    if (!result) return;
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const created = await publicCreateBookingRequest({
        bookingId: bookingId.trim(),
        identifier: identifier.trim(),
        type: requestType,
        message: requestMessage || undefined
      });
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, requests: [created, ...(prev.requests || [])] };
      });
      setRequestMessage("");
      setRequestSuccess(m.requestSent);
    } catch (err: any) {
      setRequestError(err?.message || "Failed");
    } finally {
      setRequestLoading(false);
    }
  }

  async function submitReply(requestId: string) {
    if (!result) return;
    const message = replyEdits[requestId]?.trim();
    if (!message) {
      setRequestError(locale === "ar" ? "يرجى كتابة الرد" : "Please enter a response");
      return;
    }
    setReplySavingId(requestId);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const updated = await publicRespondToBookingRequest({
        bookingId: bookingId.trim(),
        identifier: identifier.trim(),
        requestId,
        message
      });
      const newMessage = {
        id: `tmp-${Date.now()}`,
        actor: "CUSTOMER" as const,
        message,
        createdAt: new Date().toISOString()
      };
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          requests: prev.requests.map((r) => {
            if (r.id !== requestId) return r;
            const messages = Array.isArray(r.messages) ? [...r.messages, newMessage] : [newMessage];
            return { ...r, ...updated, messages };
          })
        };
      });
      setReplyEdits((prev) => ({ ...prev, [requestId]: "" }));
      setRequestSuccess(m.customerResponseSent);
    } catch (err: any) {
      setRequestError(err?.message || "Failed");
    } finally {
      setReplySavingId(null);
    }
  }

  const booking = result?.booking;
  const requests = result?.requests || [];
  const unitName = booking
    ? locale === "ar"
      ? booking.unitType?.nameAr
      : booking.unitType?.nameEn
    : "";
  const totalAmount = typeof booking?.totalAmount === "number" ? booking.totalAmount : null;
  const discountPercent = typeof booking?.discountPercent === "number" ? booking.discountPercent : null;
  const discountAmount = typeof booking?.discountAmount === "number" ? booking.discountAmount : null;
  const totalBeforeDiscount =
    totalAmount !== null && discountAmount !== null ? totalAmount + discountAmount : null;

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white border shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-bold text-primary mb-2">{m.myBookings}</h1>
          <p className="text-sm text-gray-600">{m.confirmedOnlyNote}</p>
          <form onSubmit={handleLookup} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm text-gray-700">
              {m.bookingId}
              <input
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
                required
              />
            </label>
            <label className="text-sm text-gray-700">
              {m.identifier}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border"
                required
              />
            </label>
            <button
              disabled={loading}
              className="mt-6 px-4 py-3 rounded-2xl bg-primary text-white font-semibold"
            >
              {loading ? (locale === "ar" ? "جارٍ البحث..." : "Searching...") : m.lookupBooking}
            </button>
          </form>
          {error ? <div className="mt-3 p-3 rounded-xl bg-red-50 border text-red-700 text-sm">{error}</div> : null}
        </div>

        {booking ? (
          <div className="grid gap-4">
            <div className="rounded-3xl bg-white border shadow-sm p-6">
              <h2 className="text-lg font-bold text-primary mb-3">{m.bookingDetails}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
                <div>
                  <div className="text-xs text-gray-500">{m.bookingId}</div>
                  <div className="font-mono">{booking.bookingCode || booking.id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.name}</div>
                  <div>{booking.guestName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.phone}</div>
                  <div>{booking.guestPhone}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.email}</div>
                  <div>{booking.guestEmail || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.checkin}</div>
                  <div>{formatDate(booking.checkIn)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.checkout}</div>
                  <div>{formatDate(booking.checkOut)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.unit}</div>
                  <div>{unitName || "—"}</div>
                  {booking.unit?.number ? (
                    <div className="text-xs text-gray-500">
                      #{booking.unit.number}{booking.unit?.floor ? ` · ${m.floor} ${booking.unit.floor}` : ""}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs text-gray-500">{m.totalAfterDiscount}</div>
                  <div>{totalAmount !== null ? `${totalAmount} ${m.sar}` : "—"}</div>
                </div>
                {discountPercent ? (
                  <div>
                    <div className="text-xs text-gray-500">{m.discount}</div>
                    <div>
                      {discountPercent}%{discountAmount !== null ? ` (${discountAmount} ${m.sar})` : ""}
                    </div>
                    {totalBeforeDiscount !== null ? (
                      <div className="text-xs text-gray-500">
                        {m.totalBeforeDiscount}: {totalBeforeDiscount} {m.sar}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl bg-white border shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-primary">{m.requests}</h2>
              </div>
              {requests.length === 0 ? (
                <div className="text-sm text-gray-600">{locale === "ar" ? "لا توجد طلبات بعد" : "No requests yet"}</div>
              ) : (
                <div className="grid gap-3">
                  {requests.map((r) => (
                    <div key={r.id} className="rounded-2xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{typeLabel(r.type)}</div>
                        <span className="px-2 py-1 rounded-full text-xs border bg-bg">
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-700">{r.message || "—"}</div>
                      {Array.isArray(r.messages) && r.messages.length ? (
                        <div className="mt-2 space-y-1">
                          {r.messages.map((msg: any) => (
                            <div key={msg.id} className="text-xs text-gray-600">
                              <span className="font-semibold">{actorLabel(msg.actor)}:</span> {msg.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {r.customerResponse ? (
                            <div className="mt-2 text-xs text-gray-600">
                              {m.customerResponseLabel}: {r.customerResponse}
                            </div>
                          ) : null}
                          {r.responseMessage ? (
                            <div className="mt-2 text-xs text-gray-600">
                              {m.requestResponse}: {r.responseMessage}
                            </div>
                          ) : null}
                        </>
                      )}
                      {r.status === "AWAITING_CUSTOMER" ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                          <textarea
                            value={replyEdits[r.id] ?? ""}
                            onChange={(e) => setReplyEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border text-sm"
                            rows={2}
                            placeholder={m.customerResponsePlaceholder}
                          />
                          <button
                            onClick={() => submitReply(r.id)}
                            disabled={replySavingId === r.id}
                            className="px-4 py-2 rounded-xl bg-primary text-white text-sm"
                          >
                            {replySavingId === r.id ? (locale === "ar" ? "جارٍ الإرسال..." : "Sending...") : m.sendCustomerResponse}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white border shadow-sm p-6">
              <h2 className="text-lg font-bold text-primary mb-3">{m.submitRequest}</h2>
              <form onSubmit={submitRequest} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-sm text-gray-700 md:col-span-1">
                  {m.requestType}
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as BookingRequestType)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border bg-white"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-700 md:col-span-2">
                  {m.requestMessage}
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    rows={3}
                  />
                </label>
                <button
                  disabled={requestLoading}
                  className="md:col-span-3 px-4 py-3 rounded-2xl bg-accent text-white font-semibold"
                >
                  {requestLoading ? (locale === "ar" ? "جارٍ الإرسال..." : "Sending...") : m.submitRequest}
                </button>
              </form>
              {requestError ? (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border text-red-700 text-sm">{requestError}</div>
              ) : null}
              {requestSuccess ? (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border text-emerald-700 text-sm">{requestSuccess}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MyBookingsContent />
    </Suspense>
  );
}
