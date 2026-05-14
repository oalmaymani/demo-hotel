import Link from "next/link";
import type { UnitType } from "@/lib/api";

export function UnitCard({
  t,
  locale,
  labels,
  hrefQuery
}: {
  t: UnitType;
  locale: "ar" | "en";
  labels: any;
  hrefQuery?: string;
}) {
  const name = locale === "ar" ? t.nameAr : t.nameEn;
  const desc = locale === "ar" ? t.descriptionAr : t.descriptionEn;
  const cover = t.images?.find((i) => i.isPrimary)?.url || t.images?.[0]?.url || t.imageUrl || "";
  const nightlyPrice = t.priceSummary?.avgNightly ?? t.basePrice;
  const querySuffix = hrefQuery ? `?${hrefQuery}` : `?lang=${locale}`;

  return (
    <div className="rounded-2xl bg-white shadow-sm border overflow-hidden">
      <div className="h-40 bg-bg flex items-center justify-center text-primary/60">
        {cover ? <img src={cover} alt={name} className="h-full w-full object-cover" /> : <span>Image</span>}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-primary">{name}</h3>
          <div className="text-sm font-bold text-accent">{nightlyPrice} SAR</div>
        </div>
        <p className="text-sm text-gray-700 line-clamp-2">{desc}</p>
        {t.priceSummary ? (
          <div className="text-xs text-gray-500">
            {labels.totalPrice}: {t.priceSummary.total} SAR
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{t.bedrooms} BR</span>
          {typeof t.availableCount === "number" ? (
            t.availableCount <= 2 ? (
              <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {labels.lowAvailability}: {t.availableCount}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-bg border">{labels.availableCount}: {t.availableCount}</span>
            )
          ) : null}
        </div>
        <div className="flex gap-2 pt-2">
          <Link href={`/units/${t.id}${querySuffix}`} className="flex-1 text-center px-3 py-2 rounded-xl border hover:bg-bg text-sm">
            {labels.details}
          </Link>
          <Link href={`/book/${t.id}${querySuffix}`} className="flex-1 text-center px-3 py-2 rounded-xl bg-primary text-white text-sm">
            {labels.book}
          </Link>
        </div>
      </div>
    </div>
  );
}
