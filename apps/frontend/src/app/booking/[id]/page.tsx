import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getLocale(searchParams: SearchParams): Locale {
  const l = getSingleValue(searchParams?.lang);
  return l === "en" ? "en" : "ar";
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function BookingConfirmation({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const locale = getLocale(resolvedSearchParams);
  const m = getMessages(locale);
  const code = getSingleValue(resolvedSearchParams?.code);
  const bookingRef = code || id;

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-3xl bg-white border shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-bold text-primary">{m.bookingReceived}</h1>
          <p className="mt-2 text-gray-700">{m.weWillContact}</p>
          <div className="mt-6 p-4 rounded-2xl bg-bg border">
            <div className="text-sm text-gray-600">{locale === "ar" ? "رقم الحجز" : "Booking ID"}</div>
            <div className="font-mono text-primary font-semibold">{bookingRef}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
