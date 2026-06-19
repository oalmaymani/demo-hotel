import { Navbar } from "@/components/Navbar";
import { UnitCard } from "@/components/UnitCard";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { getPublicSettings, getUnitTypes, type SiteSettings } from "@/lib/api";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getLocale(searchParams: SearchParams): Locale {
  const l = getSingleValue(searchParams?.lang);
  return l === "en" ? "en" : "ar";
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const locale = getLocale(resolvedSearchParams);
  const m = getMessages(locale);
  const dateInputClass = `px-3 py-2 rounded-xl border ${isRTL(locale) ? "text-right" : "text-left"}`;

  const checkIn = getSingleValue(resolvedSearchParams?.checkIn);
  const checkOut = getSingleValue(resolvedSearchParams?.checkOut);
  const guests = getSingleValue(resolvedSearchParams?.guests);

  const [types, settings] = await Promise.all([
    getUnitTypes({ checkIn, checkOut }),
    getPublicSettings().catch(() => ({} as SiteSettings))
  ]);
  const hasDates = Boolean(checkIn && checkOut);
  const visibleTypes = hasDates ? types.filter((t) => (t.availableCount ?? 0) > 0) : types;

  const query = new URLSearchParams();
  query.set("lang", locale);
  if (checkIn) query.set("checkIn", checkIn);
  if (checkOut) query.set("checkOut", checkOut);
  if (guests) query.set("guests", guests);
  const hrefQuery = query.toString();

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-3xl bg-white border shadow-sm overflow-hidden">
          <div className="p-8 md:p-10 flex flex-col gap-4">
            <h1 className="text-3xl md:text-4xl font-extrabold text-primary">{m.brand}</h1>
            <p className="text-gray-700">{locale === "ar" ? "إقامة مريحة… بخيارات تناسبك" : "Comfortable stay… options that fit you"}</p>
            <a href={`#search`} className="inline-flex w-fit px-5 py-3 rounded-2xl bg-primary text-white font-semibold">
              {m.cta}
            </a>
          </div>
          <div className="h-48 md:h-64 bg-bg relative overflow-hidden">
            {settings.heroImageUrl ? (
              <>
                <img src={settings.heroImageUrl} alt="Hero" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-primary/50">Hero Image Placeholder</div>
            )}
          </div>
        </section>

        <section id="search" className="mt-6 rounded-3xl bg-white border shadow-sm p-4 md:p-6">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" action="/" method="GET">
            <input type="hidden" name="lang" value={locale} />
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.checkin}
              <input
                name="checkIn"
                type="date"
                dir="ltr"
                defaultValue={checkIn || ""}
                className={dateInputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.checkout}
              <input
                name="checkOut"
                type="date"
                dir="ltr"
                defaultValue={checkOut || ""}
                className={dateInputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {m.guests}
              <input
                name="guests"
                type="number"
                min="1"
                defaultValue={guests || "1"}
                className="px-3 py-2 rounded-xl border"
              />
            </label>
            <button className="h-[68px] md:h-auto mt-0 md:mt-6 px-4 py-3 rounded-2xl bg-accent text-white font-semibold">
              {m.showAvailable}
            </button>
          </form>
        </section>

        <section className="mt-8">
          {visibleTypes.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-600">
              {m.noAvailability}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visibleTypes.map((t) => (
                <UnitCard key={t.id} t={t} locale={locale} labels={m} hrefQuery={hrefQuery} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 text-sm text-gray-600 py-6">
          {locale === "ar" ? "© الشقق المفروشة" : "© Serviced Apartments"}
        </footer>
      </main>
    </div>
  );
}
