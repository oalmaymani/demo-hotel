"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import {
  API_BASE,
  createBooking,
  getUnitType,
  type PriceSummary
} from "@/lib/api";

function BookPageContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);
  const dateInputClass = `px-3 py-2 rounded-xl border ${isRTL(locale) ? "text-right" : "text-left"}`;

  const [checkIn, setCheckIn] = useState(sp.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(sp.get("checkOut") || "");
  const [guestsCount, setGuestsCount] = useState(Number(sp.get("guests") || 1));
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [guestEmail, setGuestEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [nationality, setNationality] = useState("");
  const [priceSummary, setPriceSummary] = useState<PriceSummary | null>(null);
  const [minNights, setMinNights] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPricing() {
      if (!params.id || !checkIn || !checkOut) {
        setPriceSummary(null);
        setMinNights(null);
        return;
      }
      try {
        const t = await getUnitType(params.id, { checkIn, checkOut });
        if (!active) return;
        setPriceSummary(t.priceSummary ?? null);
        setMinNights(t.minNights ?? null);
      } catch {
        if (!active) return;
        setPriceSummary(null);
        setMinNights(null);
      }
    }
    loadPricing();
    return () => {
      active = false;
    };
  }, [params.id, checkIn, checkOut]);

  const countryOptions = useMemo(() => {
    const display = typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames(locale === "ar" ? "ar" : "en", { type: "region" })
      : null;
    return getCountries()
      .map((code) => {
        const name = display?.of(code) || code;
        const dial = `+${getCountryCallingCode(code)}`;
        return { code, name, dial };
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale === "ar" ? "ar" : "en"));
  }, [locale]);

  const dialCode = useMemo(() => {
    const match = countryOptions.find((c) => c.code === countryCode);
    return match?.dial || "+966";
  }, [countryOptions, countryCode]);

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const cleaned = digits.replace(/^0+/, "");
    setGuestPhone(cleaned);
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!params.id) {
      setError(locale === "ar" ? "المعرّف غير صالح" : "Invalid unit id");
      return;
    }
    if (guestEmail.trim() !== confirmEmail.trim()) {
      setError(m.emailMismatch);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await createBooking({
        unitTypeId: params.id,
        checkIn,
        checkOut,
        guestName,
        guestPhone: `${dialCode}${guestPhone}`,
        guestEmail,
        guestsCount,
        notes,
        nationality
      });
      const codeQuery = out.bookingCode ? `&code=${out.bookingCode}` : "";
      router.push(`/booking/${out.id}?lang=${locale}${codeQuery}`);
    } catch (err: any) {
      setError(err?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl bg-white border shadow-sm p-6">
          <h1 className="text-2xl font-bold text-primary mb-4">{m.confirmBooking}</h1>
          {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}
          {priceSummary ? (
            <div className="mb-3 p-3 rounded-xl bg-bg border text-sm text-gray-700">
              {m.totalPrice}: {priceSummary.total} SAR ({priceSummary.nights} {locale === "ar" ? "ليالي" : "nights"})
            </div>
          ) : null}
          {minNights ? (
            <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-700 text-sm">
              {m.minStayNotice}: {minNights} {locale === "ar" ? "ليالي" : "nights"}
            </div>
          ) : null}
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.checkin}
              <input
                type="date"
                dir="ltr"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={dateInputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.checkout}
              <input
                type="date"
                dir="ltr"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className={dateInputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.guests}
              <input type="number" min="1" value={guestsCount} onChange={(e) => setGuestsCount(Number(e.target.value))} className="px-3 py-2 rounded-xl border" />
            </label>
            <div className="hidden md:block" />
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.name}
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="px-3 py-2 rounded-xl border" required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.phone}
              <div className="mt-1 grid grid-cols-[120px_1fr] gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-2 rounded-xl border bg-white"
                  aria-label={m.countryCode}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.dial} {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={guestPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="px-3 py-2 rounded-xl border"
                  required
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.email}
              <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="px-3 py-2 rounded-xl border" required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.confirmEmail}
              <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="px-3 py-2 rounded-xl border" required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.nationality}
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} className="px-3 py-2 rounded-xl border" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
              {m.notes}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="px-3 py-2 rounded-xl border" rows={3} />
            </label>

            <button disabled={loading} className="md:col-span-2 px-5 py-3 rounded-2xl bg-primary text-white font-semibold">
              {loading ? (locale === "ar" ? "جارٍ الإرسال..." : "Submitting...") : m.confirmBooking}
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-500">
            API: {API_BASE}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BookPageContent />
    </Suspense>
  );
}
