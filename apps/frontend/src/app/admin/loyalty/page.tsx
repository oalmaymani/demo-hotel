"use client";

export const dynamic = "force-dynamic";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
// Navbar is provided by admin layout
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import { adminAddLoyaltyBenefit, adminDeleteLoyaltyBenefit, adminGetLoyaltyProgram, adminUpdateLoyaltyProgram } from "@/lib/api";

type LoyaltyProgram = {
  id: string;
  isEnabled: boolean;
  minRepeatBookings: number;
  descriptionAr: string;
  descriptionEn: string;
  benefits: LoyaltyBenefit[];
  createdAt: string;
  updatedAt: string;
};

type LoyaltyBenefit = {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  type: "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "BONUS_POINTS" | "FREE_UPGRADE";
  value: number;
  isActive: boolean;
  sortOrder: number;
};

function AdminLoyaltyContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);

  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Program form
  const [isEnabled, setIsEnabled] = useState(true);
  const [minRepeatBookings, setMinRepeatBookings] = useState(1);
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");

  // Benefit form
  const [addingBenefit, setAddingBenefit] = useState(false);
  const [benefitNameAr, setBenefitNameAr] = useState("");
  const [benefitNameEn, setBenefitNameEn] = useState("");
  const [benefitDescAr, setBenefitDescAr] = useState("");
  const [benefitDescEn, setBenefitDescEn] = useState("");
  const [benefitType, setBenefitType] = useState<LoyaltyBenefit["type"]>("DISCOUNT_PERCENT");
  const [benefitValue, setBenefitValue] = useState(10);

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
    }
    setIsSuperAdmin(localStorage.getItem("towseasons_admin_super") === "true");
    setToken(t);
  }, [locale, router]);

  const canManage = isSuperAdmin;

  async function loadProgram(t: string) {
    setError(null);
    setLoading(true);
    try {
      const data = await adminGetLoyaltyProgram(t);
      setProgram(data);
      setIsEnabled(data.isEnabled);
      setMinRepeatBookings(data.minRepeatBookings);
      setDescriptionAr(data.descriptionAr);
      setDescriptionEn(data.descriptionEn);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && canManage) loadProgram(token);
  }, [token, canManage]);

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  async function saveProgram(e: any) {
    e.preventDefault();
    if (!token || !canManage) return;
    setError(null);
    setLoading(true);
    try {
      const data = await adminUpdateLoyaltyProgram(token, {
        isEnabled,
        minRepeatBookings,
        descriptionAr,
        descriptionEn
      });
      setProgram(data);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function addBenefit(e: any) {
    e.preventDefault();
    if (!token || !canManage) return;
    if (!benefitNameAr.trim() || !benefitNameEn.trim() || benefitValue <= 0) {
      setError(locale === "ar" ? "أكمل جميع الحقول" : "Fill all fields");
      return;
    }
    setAddingBenefit(true);
    setError(null);
    try {
      await adminAddLoyaltyBenefit(token, {
        nameAr: benefitNameAr,
        nameEn: benefitNameEn,
        descriptionAr: benefitDescAr,
        descriptionEn: benefitDescEn,
        type: benefitType,
        value: benefitValue
      });
      setBenefitNameAr("");
      setBenefitNameEn("");
      setBenefitDescAr("");
      setBenefitDescEn("");
      setBenefitType("DISCOUNT_PERCENT");
      setBenefitValue(10);
      await loadProgram(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setAddingBenefit(false);
    }
  }

  async function deleteBenefit(benefitId: string) {
    if (!token || !canManage || !confirm(locale === "ar" ? "هل تريد الحذف؟" : "Are you sure?")) return;
    setError(null);
    try {
      await adminDeleteLoyaltyBenefit(token, benefitId);
      await loadProgram(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  if (!token) return null;

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!canManage ? (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border text-amber-800 text-sm">
            {m.noPermission}
          </div>
        ) : null}

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        {canManage ? (
          <>
            <div className="rounded-3xl bg-white border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-bold text-primary mb-4">
                {locale === "ar" ? "إعدادات برنامج الولاء" : "Loyalty Program Settings"}
              </h2>
              <form onSubmit={saveProgram} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-700">
                  {locale === "ar" ? "الحد الأدنى للحجوزات المكررة" : "Min Repeat Bookings"}
                  <input
                    type="number"
                    min="1"
                    value={minRepeatBookings}
                    onChange={(e) => setMinRepeatBookings(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>

                <label className="text-sm text-gray-700 flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  {locale === "ar" ? "مفعّل" : "Enabled"}
                </label>

                <label className="md:col-span-2 text-sm text-gray-700">
                  {locale === "ar" ? "الوصف بالعربية" : "Description (Arabic)"}
                  <textarea
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    rows={2}
                  />
                </label>

                <label className="md:col-span-2 text-sm text-gray-700">
                  {locale === "ar" ? "الوصف بالإنجليزية" : "Description (English)"}
                  <textarea
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    rows={2}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-2 px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "..." : locale === "ar" ? "حفظ" : "Save"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl bg-white border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-bold text-primary mb-4">
                {locale === "ar" ? "إضافة مزية" : "Add Benefit"}
              </h2>
              <form onSubmit={addBenefit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-gray-700">
                  {locale === "ar" ? "الاسم بالعربية" : "Name (Arabic)"}
                  <input
                    value={benefitNameAr}
                    onChange={(e) => setBenefitNameAr(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>

                <label className="text-sm text-gray-700">
                  {locale === "ar" ? "الاسم بالإنجليزية" : "Name (English)"}
                  <input
                    value={benefitNameEn}
                    onChange={(e) => setBenefitNameEn(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>

                <label className="text-sm text-gray-700">
                  {locale === "ar" ? "النوع" : "Type"}
                  <select
                    value={benefitType}
                    onChange={(e) => setBenefitType(e.target.value as LoyaltyBenefit["type"])}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  >
                    <option value="DISCOUNT_PERCENT">
                      {locale === "ar" ? "خصم نسبة مئوية" : "Discount (%)"}
                    </option>
                    <option value="DISCOUNT_FIXED">
                      {locale === "ar" ? "خصم مبلغ ثابت" : "Discount (Fixed)"}
                    </option>
                    <option value="BONUS_POINTS">
                      {locale === "ar" ? "نقاط إضافية" : "Bonus Points"}
                    </option>
                    <option value="FREE_UPGRADE">
                      {locale === "ar" ? "ترقية مجانية" : "Free Upgrade"}
                    </option>
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  {locale === "ar" ? "القيمة" : "Value"}
                  <input
                    type="number"
                    min="1"
                    value={benefitValue}
                    onChange={(e) => setBenefitValue(Math.max(1, parseInt(e.target.value) || 10))}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>

                <label className="md:col-span-2 text-sm text-gray-700">
                  {locale === "ar" ? "الوصف بالعربية" : "Description (Arabic)"}
                  <textarea
                    value={benefitDescAr}
                    onChange={(e) => setBenefitDescAr(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    rows={2}
                  />
                </label>

                <label className="md:col-span-2 text-sm text-gray-700">
                  {locale === "ar" ? "الوصف بالإنجليزية" : "Description (English)"}
                  <textarea
                    value={benefitDescEn}
                    onChange={(e) => setBenefitDescEn(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    rows={2}
                  />
                </label>

                <button
                  type="submit"
                  disabled={addingBenefit}
                  className="md:col-span-2 px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50"
                >
                  {addingBenefit ? "..." : locale === "ar" ? "إضافة" : "Add"}
                </button>
              </form>
            </div>

            {program && program.benefits.length > 0 ? (
              <div className="rounded-3xl bg-white border shadow-sm p-5">
                <h2 className="text-lg font-bold text-primary mb-4">
                  {locale === "ar" ? "المزايا النشطة" : "Active Benefits"}
                </h2>
                <div className="space-y-3">
                  {program.benefits.map((benefit) => (
                    <div key={benefit.id} className="p-4 rounded-xl border flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="font-semibold">
                          {locale === "ar" ? benefit.nameAr : benefit.nameEn}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {locale === "ar" ? benefit.descriptionAr : benefit.descriptionEn}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">
                          {locale === "ar" ? "النوع" : "Type"}: {benefit.type} | {locale === "ar" ? "القيمة" : "Value"}: {benefit.value}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBenefit(benefit.id)}
                        className="px-3 py-1 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100"
                      >
                        {locale === "ar" ? "حذف" : "Delete"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminLoyalty() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminLoyaltyContent />
    </Suspense>
  );
}
