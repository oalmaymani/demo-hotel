import { Navbar } from "@/components/Navbar";
import { UnitGallery } from "@/components/UnitGallery";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { getUnitType } from "@/lib/api";

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

export default async function UnitTypePage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const locale = getLocale(resolvedSearchParams);
  const m = getMessages(locale);
  const checkIn = getSingleValue(resolvedSearchParams?.checkIn);
  const checkOut = getSingleValue(resolvedSearchParams?.checkOut);
  const guests = getSingleValue(resolvedSearchParams?.guests);

  const query = new URLSearchParams();
  query.set("lang", locale);
  if (checkIn) query.set("checkIn", checkIn);
  if (checkOut) query.set("checkOut", checkOut);
  if (guests) query.set("guests", guests);
  const hrefQuery = query.toString();

  const t = await getUnitType(id, checkIn && checkOut ? { checkIn, checkOut } : undefined);
  const name = locale === "ar" ? t.nameAr : t.nameEn;
  const desc = locale === "ar" ? t.descriptionAr : t.descriptionEn;
  const images = (t.images && t.images.length ? t.images.map((i) => i.url) : t.imageUrl ? [t.imageUrl] : []);
  const nightly = t.priceSummary?.avgNightly ?? t.basePrice;

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white border shadow-sm overflow-hidden">
          <UnitGallery images={images} alt={name} />
          <div className="p-6 flex flex-col gap-3">
            <h1 className="text-2xl font-bold text-primary">{name}</h1>
            <p className="text-gray-700">{desc}</p>
            <div className="flex items-center justify-between">
              <div className="text-gray-700">{t.bedrooms} BR • {t.kitchen}</div>
              <div className="text-lg font-extrabold text-accent">{nightly} SAR</div>
            </div>
            {t.priceSummary ? (
              <div className="text-sm text-gray-600">
                {m.totalPrice}: {t.priceSummary.total} SAR ({t.priceSummary.nights} {locale === "ar" ? "ليالي" : "nights"})
              </div>
            ) : null}
            {t.minNights ? (
              <div className="text-sm text-amber-700">
                {m.minStayNotice}: {t.minNights} {locale === "ar" ? "ليالي" : "nights"}
              </div>
            ) : null}
            <a href={`/book/${t.id}?${hrefQuery}`} className="mt-2 inline-flex justify-center px-5 py-3 rounded-2xl bg-primary text-white font-semibold">
              {m.book}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
