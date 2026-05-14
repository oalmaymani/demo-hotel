"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMessages, isRTL, type Locale } from "@/lib/i18n";
import {
  adminAddUnitImage,
  adminAddUnitPhoto,
  adminAddSeasonalRate,
  adminAddMinStayRule,
  adminCreateBlock,
  adminDeleteBlock,
  adminDeleteMinStayRule,
  adminDeleteSeasonalRate,
  adminDeleteUnitImage,
  adminDeleteUnitPhoto,
  adminGetBlocks,
  adminGetSettings,
  adminGetUnitTypes,
  adminGetUnits,
  adminUpdateSettings,
  adminSetUnitPhotoPrimary,
  adminSetUnitActive,
  adminSetUnitImagePrimary,
  adminUpdateUnitType,
  adminUploadImage
} from "@/lib/api";

type UnitRow = {
  id: string;
  number: number;
  floor: number;
  isActive: boolean;
  unitType: { nameAr: string; nameEn: string };
  photos?: { id: string; url: string; isPrimary: boolean }[];
};

type BlockRow = {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  unit: { number: number; floor: number; unitType: { nameAr: string; nameEn: string } };
};

type UnitTypeRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  basePrice: number;
  imageUrl?: string | null;
  images?: { id: string; url: string; isPrimary: boolean }[];
  seasonalRates?: { id: string; startDate: string; endDate: string; pricePerNight: number }[];
  minStayRules?: { id: string; startDate: string; endDate: string; minNights: number }[];
};

function AdminAvailabilityContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale: Locale = sp.get("lang") === "en" ? "en" : "ar";
  const m = getMessages(locale);
  const floorTag = (floor: number) => (locale === "ar" ? `${m.floor} ${floor}` : `F${floor}`);

  const [token, setToken] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitTypeRow[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [heroPreviewFile, setHeroPreviewFile] = useState<File | null>(null);
  const [heroZoom, setHeroZoom] = useState(1);
  const [heroOffset, setHeroOffset] = useState({ x: 0, y: 0 });
  const [heroImgMeta, setHeroImgMeta] = useState<{ w: number; h: number } | null>(null);
  const [heroBox, setHeroBox] = useState<{ w: number; h: number } | null>(null);
  const heroBoxRef = useRef<HTMLDivElement | null>(null);
  const heroDragRef = useRef<{ active: boolean; startX: number; startY: number; startOffset: { x: number; y: number } }>({
    active: false,
    startX: 0,
    startY: 0,
    startOffset: { x: 0, y: 0 }
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [imageSavingId, setImageSavingId] = useState<string | null>(null);
  const [seasonSavingId, setSeasonSavingId] = useState<string | null>(null);
  const [minStaySavingId, setMinStaySavingId] = useState<string | null>(null);
  const [seasonEdits, setSeasonEdits] = useState<Record<string, { startDate: string; endDate: string; price: string }>>({});
  const [minStayEdits, setMinStayEdits] = useState<Record<string, { startDate: string; endDate: string; nights: string }>>({});
  const [uploadingUnitId, setUploadingUnitId] = useState<string | null>(null);
  const [unitPhotoSavingId, setUnitPhotoSavingId] = useState<string | null>(null);
  const [openUnitPhotosId, setOpenUnitPhotosId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"units" | "blocks">("units");

  const [unitSearch, setUnitSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [unitSort, setUnitSort] = useState<"numberAsc" | "numberDesc" | "floorAsc" | "floorDesc">("numberAsc");
  const [groupByFloor, setGroupByFloor] = useState(false);

  const [blockSearch, setBlockSearch] = useState("");
  const [blockSort, setBlockSort] = useState<"newest" | "oldest">("newest");

  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

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
      const [u, b, types, settings] = await Promise.all([
        adminGetUnits(t),
        adminGetBlocks(t),
        adminGetUnitTypes(t),
        adminGetSettings(t)
      ]);
      setUnits(u);
      setBlocks(b);
      setUnitTypes(types);
      setHeroImageUrl(settings?.heroImageUrl || null);
      setPriceEdits((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const t of types) {
          if (next[t.id] === undefined) {
            next[t.id] = String(t.basePrice ?? 0);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      if (!unitId && u?.[0]?.id) setUnitId(u[0].id);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
  }

  useEffect(() => {
    if (token) loadAll(token);
  }, [token]);

  useEffect(() => {
    return () => {
      if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
    };
  }, [heroPreviewUrl]);

  useEffect(() => {
    if (!heroPreviewUrl) {
      setHeroImgMeta(null);
      return;
    }
    const img = new Image();
    img.onload = () => setHeroImgMeta({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = heroPreviewUrl;
  }, [heroPreviewUrl]);

  useEffect(() => {
    const el = heroBoxRef.current;
    if (!el) return;
    const update = () => setHeroBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heroPreviewUrl]);

  async function toggleUnit(id: string, next: boolean) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await adminSetUnitActive(token, id, next);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addBlock(e: any) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await adminCreateBlock(token, { unitId, startDate, endDate, reason: reason || undefined });
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف الحظر؟" : "Delete this block?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await adminDeleteBlock(token, id);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePrice(typeId: string) {
    if (!token) return;
    const value = Number(priceEdits[typeId] || 0);
    if (Number.isNaN(value) || value < 0) {
      setError(locale === "ar" ? "السعر غير صالح" : "Invalid price");
      return;
    }
    setError(null);
    setPriceSavingId(typeId);
    try {
      await adminUpdateUnitType(token, typeId, { basePrice: Math.round(value) });
      setPriceEdits((prev) => ({ ...prev, [typeId]: String(Math.round(value)) }));
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setPriceSavingId(null);
    }
  }

  async function uploadImage(typeId: string, file: File) {
    if (!token) return;
    setError(null);
    setUploadingTypeId(typeId);
    try {
      const out = await adminUploadImage(token, file);
      await adminAddUnitImage(token, typeId, out.url);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUploadingTypeId(null);
    }
  }

  async function uploadHeroImage(file: File) {
    if (!token) return;
    setError(null);
    setUploadingHero(true);
    try {
      const out = await adminUploadImage(token, file);
      await adminUpdateSettings(token, { heroImageUrl: out.url });
      setHeroPreviewFile(null);
      if (heroPreviewUrl) {
        URL.revokeObjectURL(heroPreviewUrl);
        setHeroPreviewUrl(null);
      }
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUploadingHero(false);
    }
  }

  async function removeHeroImage() {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف صورة الهيرو؟" : "Delete hero image?");
    if (!ok) return;
    setUploadingHero(true);
    setError(null);
    try {
      await adminUpdateSettings(token, { heroImageUrl: null });
      setHeroPreviewFile(null);
      if (heroPreviewUrl) {
        URL.revokeObjectURL(heroPreviewUrl);
        setHeroPreviewUrl(null);
      }
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUploadingHero(false);
    }
  }

  function clampHeroOffset(next: { x: number; y: number }) {
    if (!heroBox || !heroImgMeta) return next;
    const baseScale = Math.max(heroBox.w / heroImgMeta.w, heroBox.h / heroImgMeta.h);
    const scale = baseScale * heroZoom;
    const dispW = heroImgMeta.w * scale;
    const dispH = heroImgMeta.h * scale;
    const maxX = Math.max(0, (dispW - heroBox.w) / 2);
    const maxY = Math.max(0, (dispH - heroBox.h) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y))
    };
  }

  useEffect(() => {
    if (!heroPreviewUrl) return;
    setHeroOffset((prev) => clampHeroOffset(prev));
  }, [heroZoom, heroBox, heroImgMeta, heroPreviewUrl]);

  async function saveHeroCrop() {
    if (!heroPreviewFile || !heroPreviewUrl || !heroBox || !heroImgMeta || !token) return;
    setUploadingHero(true);
    setError(null);
    try {
      const img = new Image();
      const ready = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
      });
      img.src = heroPreviewUrl;
      await ready;

      const baseScale = Math.max(heroBox.w / heroImgMeta.w, heroBox.h / heroImgMeta.h);
      const scale = baseScale * heroZoom;
      const dispW = heroImgMeta.w * scale;
      const dispH = heroImgMeta.h * scale;
      const imgLeft = heroBox.w / 2 - dispW / 2 + heroOffset.x;
      const imgTop = heroBox.h / 2 - dispH / 2 + heroOffset.y;

      let sx = (0 - imgLeft) / scale;
      let sy = (0 - imgTop) / scale;
      const sWidth = heroBox.w / scale;
      const sHeight = heroBox.h / scale;

      sx = Math.max(0, Math.min(heroImgMeta.w - sWidth, sx));
      sy = Math.max(0, Math.min(heroImgMeta.h - sHeight, sy));

      const outputW = 1600;
      const outputH = Math.round(outputW * (heroBox.h / heroBox.w));
      const canvas = document.createElement("canvas");
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outputW, outputH);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Failed to export image");
      const file = new File([blob], "hero.jpg", { type: "image/jpeg" });
      await uploadHeroImage(file);
    } catch (e: any) {
      setError(e?.message || "Failed");
      setUploadingHero(false);
    }
  }

  async function uploadImages(typeId: string, files: FileList | null) {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      // Upload sequentially to avoid race on primary selection
      await uploadImage(typeId, file);
    }
  }

  async function setPrimaryImage(imageId: string) {
    if (!token) return;
    setImageSavingId(imageId);
    setError(null);
    try {
      await adminSetUnitImagePrimary(token, imageId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setImageSavingId(null);
    }
  }

  async function deleteImage(imageId: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف الصورة؟" : "Delete this image?");
    if (!ok) return;
    setImageSavingId(imageId);
    setError(null);
    try {
      await adminDeleteUnitImage(token, imageId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setImageSavingId(null);
    }
  }

  async function deleteLegacyImage(typeId: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف الصورة؟" : "Delete this image?");
    if (!ok) return;
    setImageSavingId(`legacy-${typeId}`);
    setError(null);
    try {
      await adminUpdateUnitType(token, typeId, { imageUrl: null });
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setImageSavingId(null);
    }
  }

  async function addSeasonalRate(typeId: string) {
    if (!token) return;
    const draft = seasonEdits[typeId];
    const price = Number(draft?.price || 0);
    if (!draft?.startDate || !draft?.endDate || Number.isNaN(price) || price < 0) {
      setError(locale === "ar" ? "البيانات غير صالحة" : "Invalid data");
      return;
    }
    setSeasonSavingId(typeId);
    setError(null);
    try {
      await adminAddSeasonalRate(token, typeId, {
        startDate: draft.startDate,
        endDate: draft.endDate,
        pricePerNight: Math.round(price)
      });
      setSeasonEdits((prev) => ({ ...prev, [typeId]: { startDate: "", endDate: "", price: "" } }));
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSeasonSavingId(null);
    }
  }

  async function deleteSeasonalRate(rateId: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف السعر الموسمي؟" : "Delete seasonal rate?");
    if (!ok) return;
    setSeasonSavingId(rateId);
    setError(null);
    try {
      await adminDeleteSeasonalRate(token, rateId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSeasonSavingId(null);
    }
  }

  async function addMinStayRule(typeId: string) {
    if (!token) return;
    const draft = minStayEdits[typeId];
    const nights = Number(draft?.nights || 0);
    if (!draft?.startDate || !draft?.endDate || Number.isNaN(nights) || nights < 1) {
      setError(locale === "ar" ? "البيانات غير صالحة" : "Invalid data");
      return;
    }
    setMinStaySavingId(typeId);
    setError(null);
    try {
      await adminAddMinStayRule(token, typeId, {
        startDate: draft.startDate,
        endDate: draft.endDate,
        minNights: Math.round(nights)
      });
      setMinStayEdits((prev) => ({ ...prev, [typeId]: { startDate: "", endDate: "", nights: "" } }));
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setMinStaySavingId(null);
    }
  }

  async function deleteMinStayRule(ruleId: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف شرط الحد الأدنى؟" : "Delete min-stay rule?");
    if (!ok) return;
    setMinStaySavingId(ruleId);
    setError(null);
    try {
      await adminDeleteMinStayRule(token, ruleId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setMinStaySavingId(null);
    }
  }

  async function uploadUnitPhoto(unitId: string, file: File) {
    if (!token) return;
    setError(null);
    setUploadingUnitId(unitId);
    try {
      const out = await adminUploadImage(token, file);
      await adminAddUnitPhoto(token, unitId, { url: out.url });
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUploadingUnitId(null);
    }
  }

  async function uploadUnitPhotos(unitId: string, files: FileList | null) {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      await uploadUnitPhoto(unitId, file);
    }
  }

  async function setPrimaryUnitPhoto(photoId: string) {
    if (!token) return;
    setUnitPhotoSavingId(photoId);
    setError(null);
    try {
      await adminSetUnitPhotoPrimary(token, photoId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUnitPhotoSavingId(null);
    }
  }

  async function deleteUnitPhoto(photoId: string) {
    if (!token) return;
    const ok = window.confirm(locale === "ar" ? "حذف الصورة؟" : "Delete this image?");
    if (!ok) return;
    setUnitPhotoSavingId(photoId);
    setError(null);
    try {
      await adminDeleteUnitPhoto(token, photoId);
      await loadAll(token);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setUnitPhotoSavingId(null);
    }
  }

  function logout() {
    localStorage.removeItem("towseasons_admin_token");
    localStorage.removeItem("towseasons_admin_perms");
    localStorage.removeItem("towseasons_admin_super");
    router.push(`/admin/login?lang=${locale}`);
  }

  function resetUnitFilters() {
    setUnitSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setFloorFilter("all");
    setUnitSort("numberAsc");
    setGroupByFloor(false);
  }

  const dateInputClass = `px-3 py-2 rounded-xl border ${isRTL(locale) ? "text-right" : "text-left"}`;
  const nowTs = Date.now();

  const kpis = useMemo(() => {
    const totalUnits = units.length;
    const activeUnits = units.filter((u) => u.isActive).length;
    const inactiveUnits = totalUnits - activeUnits;
    const totalBlocks = blocks.length;
    const activeBlocks = blocks.filter((b) => {
      const s = new Date(b.startDate).getTime();
      const e = new Date(b.endDate).getTime();
      return s <= nowTs && e > nowTs;
    }).length;
    const upcomingBlocks = blocks.filter((b) => new Date(b.startDate).getTime() > nowTs).length;
    return { totalUnits, activeUnits, inactiveUnits, totalBlocks, activeBlocks, upcomingBlocks };
  }, [units, blocks, nowTs]);

  const typeOptions = useMemo(() => {
    const map = new Map<string, { key: string; labelAr: string; labelEn: string }>();
    for (const u of units) {
      const key = u.unitType.nameEn;
      if (!map.has(key)) {
        map.set(key, { key, labelAr: u.unitType.nameAr, labelEn: u.unitType.nameEn });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.labelEn.localeCompare(b.labelEn));
  }, [units]);

  const floorOptions = useMemo(() => {
    const set = new Set<number>();
    for (const u of units) set.add(u.floor);
    return Array.from(set).sort((a, b) => a - b);
  }, [units]);

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    return units
      .filter((u) => {
        if (statusFilter === "active" && !u.isActive) return false;
        if (statusFilter === "inactive" && u.isActive) return false;
        if (typeFilter !== "all" && u.unitType.nameEn !== typeFilter) return false;
        if (floorFilter !== "all" && String(u.floor) !== floorFilter) return false;
        if (!q) return true;
        const target = `${u.number} ${u.floor} ${u.unitType.nameEn} ${u.unitType.nameAr}`.toLowerCase();
        return target.includes(q);
      });
  }, [units, unitSearch, statusFilter, typeFilter, floorFilter]);

  const sortedUnits = useMemo(() => {
    const list = [...filteredUnits];
    list.sort((a, b) => {
      switch (unitSort) {
        case "numberDesc":
          return b.number - a.number;
        case "floorAsc":
          return a.floor - b.floor || a.number - b.number;
        case "floorDesc":
          return b.floor - a.floor || a.number - b.number;
        case "numberAsc":
        default:
          return a.number - b.number;
      }
    });
    return list;
  }, [filteredUnits, unitSort]);

  const groupedUnits = useMemo(() => {
    if (!groupByFloor) return [];
    const map = new Map<number, UnitRow[]>();
    for (const u of sortedUnits) {
      if (!map.has(u.floor)) map.set(u.floor, []);
      map.get(u.floor)?.push(u);
    }
    const floorSortDir = unitSort === "floorDesc" ? -1 : 1;
    const floors = Array.from(map.keys()).sort((a, b) => (a - b) * floorSortDir);
    return floors.map((floor) => ({ floor, units: map.get(floor) || [] }));
  }, [sortedUnits, groupByFloor, unitSort]);

  const filteredBlocks = useMemo(() => {
    const q = blockSearch.trim().toLowerCase();
    const list = blocks.filter((b) => {
      if (!q) return true;
      const target = `${b.unit.number} ${b.unit.floor} ${b.unit.unitType.nameEn} ${b.unit.unitType.nameAr} ${b.reason || ""}`.toLowerCase();
      return target.includes(q);
    });
    return list.sort((a, b) => {
      const aTime = new Date(a.startDate).getTime();
      const bTime = new Date(b.startDate).getTime();
      return blockSort === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [blocks, blockSearch, blockSort]);

  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        id: u.id,
        label: `${locale === "ar" ? u.unitType.nameAr : u.unitType.nameEn} — #${u.number} (${floorTag(u.floor)})`
      })),
    [units, locale, m]
  );

  const unitTypeCards = useMemo(
    () =>
      unitTypes.map((t) => ({
        id: t.id,
        name: locale === "ar" ? t.nameAr : t.nameEn,
        basePrice: t.basePrice,
        imageUrl: t.imageUrl || undefined,
        images: t.images || [],
        seasonalRates: t.seasonalRates || [],
        minStayRules: t.minStayRules || []
      })),
    [unitTypes, locale]
  );

  const renderUnitCard = (u: UnitRow) => {
    const photos = u.photos || [];
    const isOpen = openUnitPhotosId === u.id;
    return (
      <div key={u.id} className={`rounded-2xl border p-4 flex flex-col gap-3 ${u.isActive ? "bg-white" : "bg-gray-50"}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">#{u.number} ({floorTag(u.floor)})</div>
            <div className="font-semibold text-primary">{locale === "ar" ? u.unitType.nameAr : u.unitType.nameEn}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full border text-xs ${u.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600"}`}>
              {u.isActive ? m.active : m.inactive}
            </span>
            <button
              disabled={saving}
              onClick={() => toggleUnit(u.id, !u.isActive)}
              className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
            >
              {u.isActive ? (locale === "ar" ? "تعطيل" : "Disable") : (locale === "ar" ? "تفعيل" : "Enable")}
            </button>
            <button
              onClick={() => setOpenUnitPhotosId(isOpen ? null : u.id)}
              className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
            >
              {m.photos}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="rounded-2xl border bg-bg/40 p-3">
            <div className="flex flex-wrap gap-2">
              {photos.length ? (
                photos.map((img) => (
                  <div key={img.id} className="relative h-14 w-14 rounded-xl overflow-hidden bg-bg border">
                    <img src={img.url} alt={u.number.toString()} className="h-full w-full object-cover" />
                    {img.isPrimary ? (
                      <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-primary text-white">
                        {m.primary}
                      </span>
                    ) : null}
                    <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                      {!img.isPrimary ? (
                        <button
                          disabled={unitPhotoSavingId === img.id}
                          onClick={() => setPrimaryUnitPhoto(img.id)}
                          className="flex-1 text-[10px] px-1 py-0.5 rounded bg-white/90 border"
                        >
                          {m.setPrimary}
                        </button>
                      ) : null}
                      <button
                        disabled={unitPhotoSavingId === img.id}
                        onClick={() => deleteUnitPhoto(img.id)}
                        className="text-[10px] px-1 py-0.5 rounded bg-white/90 border"
                      >
                        {m.deleteImage}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500">{m.noImage}</div>
              )}
            </div>
            <label className="mt-2 inline-flex px-3 py-2 rounded-xl border text-xs hover:bg-bg cursor-pointer">
              {uploadingUnitId === u.id ? m.uploading : m.uploadImages}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadUnitPhotos(u.id, e.target.files);
                  e.currentTarget.value = "";
                }}
                disabled={uploadingUnitId === u.id}
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div dir={isRTL(locale) ? "rtl" : "ltr"} className="min-h-screen">
      <Navbar brand={m.brand} locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="rounded-3xl bg-white border shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-primary">{m.heroImage}</h2>
                <p className="text-xs text-gray-500">{m.heroImageHint}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3 py-2 rounded-xl border text-xs hover:bg-bg cursor-pointer">
                  {uploadingHero ? m.uploading : m.uploadHero}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
                        setHeroPreviewFile(file);
                        setHeroPreviewUrl(URL.createObjectURL(file));
                        setHeroZoom(1);
                        setHeroOffset({ x: 0, y: 0 });
                      }
                      e.currentTarget.value = "";
                    }}
                    disabled={uploadingHero}
                  />
                </label>
                {heroPreviewFile ? (
                  <>
                    <button
                      onClick={saveHeroCrop}
                      className="px-3 py-2 rounded-xl bg-primary text-white text-xs"
                      disabled={uploadingHero}
                    >
                      {m.save}
                    </button>
                    <button
                      onClick={() => {
                        setHeroPreviewFile(null);
                        if (heroPreviewUrl) URL.revokeObjectURL(heroPreviewUrl);
                        setHeroPreviewUrl(null);
                      }}
                      className="px-3 py-2 rounded-xl border text-xs hover:bg-bg"
                      disabled={uploadingHero}
                    >
                      {m.cancel}
                    </button>
                  </>
                ) : null}
                {heroImageUrl && !heroPreviewFile ? (
                  <button onClick={removeHeroImage} className="px-3 py-2 rounded-xl border text-xs hover:bg-bg" disabled={uploadingHero}>
                    {m.deleteImage}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 h-40 rounded-2xl border bg-bg overflow-hidden flex items-center justify-center text-xs text-gray-500">
              {heroPreviewUrl ? (
                <div
                  ref={heroBoxRef}
                  className="relative h-full w-full overflow-hidden cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    if (!heroPreviewUrl) return;
                    heroDragRef.current = {
                      active: true,
                      startX: e.clientX,
                      startY: e.clientY,
                      startOffset: heroOffset
                    };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!heroDragRef.current.active) return;
                    const dx = e.clientX - heroDragRef.current.startX;
                    const dy = e.clientY - heroDragRef.current.startY;
                    setHeroOffset(
                      clampHeroOffset({
                        x: heroDragRef.current.startOffset.x + dx,
                        y: heroDragRef.current.startOffset.y + dy
                      })
                    );
                  }}
                  onPointerUp={() => {
                    heroDragRef.current.active = false;
                  }}
                  onPointerLeave={() => {
                    heroDragRef.current.active = false;
                  }}
                >
                  {heroImgMeta && heroBox ? (
                    <img
                      src={heroPreviewUrl}
                      alt="hero preview"
                      className="absolute top-1/2 left-1/2 select-none pointer-events-none"
                      style={{
                        width: heroImgMeta.w * Math.max(heroBox.w / heroImgMeta.w, heroBox.h / heroImgMeta.h) * heroZoom,
                        height: heroImgMeta.h * Math.max(heroBox.w / heroImgMeta.w, heroBox.h / heroImgMeta.h) * heroZoom,
                        transform: `translate(-50%, -50%) translate(${heroOffset.x}px, ${heroOffset.y}px)`
                      }}
                    />
                  ) : (
                    <img src={heroPreviewUrl} alt="hero preview" className="h-full w-full object-cover" />
                  )}
                  <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-white/80 text-gray-700">
                    {m.dragHint}
                  </div>
                </div>
              ) : heroImageUrl ? (
                <img src={heroImageUrl} alt="hero" className="h-full w-full object-cover" />
              ) : (
                <span>{m.noImage}</span>
              )}
            </div>
            {heroPreviewFile ? (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-gray-700">{m.zoom}</label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={heroZoom}
                  onChange={(e) => setHeroZoom(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 w-10 text-right">{heroZoom.toFixed(2)}x</div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-primary">{m.manageAvailability}</h1>
              <p className="text-sm text-gray-600">{m.availabilitySubtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/bookings?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.bookings}
              </Link>
              <Link href={`/admin/requests?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.customerRequests}
              </Link>
              <Link href={`/admin/calendar?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.calendar}
              </Link>
              <Link href={`/admin/users?lang=${locale}`} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                {m.users}
              </Link>
              <button onClick={logout} className="px-4 py-2 rounded-xl border hover:bg-bg text-sm">
                {m.logout}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border shadow-sm p-4">
              <div className="text-xs text-gray-600">{m.totalUnits}</div>
              <div className="text-2xl font-extrabold text-primary">{kpis.totalUnits}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 shadow-sm p-4">
              <div className="text-xs text-emerald-700">{m.activeUnits}</div>
              <div className="text-2xl font-extrabold text-emerald-700">{kpis.activeUnits}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 border shadow-sm p-4">
              <div className="text-xs text-gray-600">{m.inactiveUnits}</div>
              <div className="text-2xl font-extrabold text-gray-700">{kpis.inactiveUnits}</div>
            </div>
            <div className="rounded-2xl bg-white border shadow-sm p-4">
              <div className="text-xs text-gray-600">{m.totalBlocks}</div>
              <div className="text-2xl font-extrabold text-primary">{kpis.totalBlocks}</div>
            </div>
            <div className="rounded-2xl bg-amber-50/70 border border-amber-100 shadow-sm p-4">
              <div className="text-xs text-amber-700">{m.activeBlocks}</div>
              <div className="text-2xl font-extrabold text-amber-700">{kpis.activeBlocks}</div>
            </div>
            <div className="rounded-2xl bg-blue-50/70 border border-blue-100 shadow-sm p-4">
              <div className="text-xs text-blue-700">{m.upcomingBlocks}</div>
              <div className="text-2xl font-extrabold text-blue-700">{kpis.upcomingBlocks}</div>
            </div>
          </div>

          {(kpis.inactiveUnits > 0 || kpis.activeBlocks > 0) ? (
            <div className="rounded-2xl border bg-amber-50/70 p-3 text-sm text-amber-800">
              {kpis.inactiveUnits > 0 ? (
                <div>{m.inactiveUnitsAlert}: {kpis.inactiveUnits}</div>
              ) : null}
              {kpis.activeBlocks > 0 ? (
                <div>{m.activeBlocks}: {kpis.activeBlocks}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 mb-4 rounded-2xl bg-white border p-2 w-fit">
          <button
            onClick={() => setActiveTab("units")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === "units" ? "bg-primary text-white" : "text-gray-700 hover:bg-bg"}`}
          >
            {m.units}
          </button>
          <button
            onClick={() => setActiveTab("blocks")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === "blocks" ? "bg-primary text-white" : "text-gray-700 hover:bg-bg"}`}
          >
            {m.blocks}
          </button>
        </div>

        {error ? <div className="mb-3 p-3 rounded-xl bg-red-50 border text-red-700">{error}</div> : null}

        {activeTab === "units" ? (
          <section className="grid gap-4">
            <div className="rounded-3xl bg-white border shadow-sm p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-primary">{m.unitTypes}</h2>
                  <p className="text-xs text-gray-500">{m.pricePerNight}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unitTypeCards.map((t) => {
                  const seasonDraft = seasonEdits[t.id] || { startDate: "", endDate: "", price: "" };
                  const minStayDraft = minStayEdits[t.id] || { startDate: "", endDate: "", nights: "" };
                  return (
                    <div key={t.id} className="rounded-2xl border p-4 flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            {(() => {
                              const cover =
                                t.images?.find((i) => i.isPrimary)?.url ||
                                t.images?.[0]?.url ||
                                t.imageUrl ||
                                "";
                              return (
                                <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-500">
                                  {cover ? (
                                    <img src={cover} alt={t.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span>{m.noImage}</span>
                                  )}
                                </div>
                              );
                            })()}
                            <div>
                              <div className="font-semibold text-primary">{t.name}</div>
                              <div className="text-xs text-gray-500">{m.sar}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(t.images?.length ? t.images : t.imageUrl ? [{ id: `legacy-${t.id}`, url: t.imageUrl, isPrimary: true }] : []).map((img) => {
                              const isLegacy = img.id.startsWith("legacy-");
                              return (
                                <div key={img.id} className="relative h-14 w-14 rounded-xl overflow-hidden bg-bg border">
                                  <img src={img.url} alt={t.name} className="h-full w-full object-cover" />
                                  {img.isPrimary ? (
                                    <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-primary text-white">
                                      {m.primary}
                                    </span>
                                  ) : null}
                                  {!isLegacy ? (
                                    <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                                      {!img.isPrimary ? (
                                        <button
                                          disabled={imageSavingId === img.id}
                                          onClick={() => setPrimaryImage(img.id)}
                                          className="flex-1 text-[10px] px-1 py-0.5 rounded bg-white/90 border"
                                        >
                                          {m.setPrimary}
                                        </button>
                                      ) : null}
                                      <button
                                        disabled={imageSavingId === img.id}
                                        onClick={() => deleteImage(img.id)}
                                        className="text-[10px] px-1 py-0.5 rounded bg-white/90 border"
                                      >
                                        {m.deleteImage}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                                      <button
                                        disabled={imageSavingId === img.id}
                                        onClick={() => deleteLegacyImage(t.id)}
                                        className="flex-1 text-[10px] px-1 py-0.5 rounded bg-white/90 border"
                                      >
                                        {m.deleteImage}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            dir="ltr"
                            value={priceEdits[t.id] ?? ""}
                            onChange={(e) => setPriceEdits((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            className="w-28 px-3 py-2 rounded-xl border text-left"
                          />
                          <button
                            disabled={priceSavingId === t.id}
                            onClick={() => savePrice(t.id)}
                            className="px-3 py-2 rounded-xl bg-primary text-white text-xs"
                          >
                            {priceSavingId === t.id ? m.saving : m.save}
                          </button>
                          <label className="px-3 py-2 rounded-xl border text-xs hover:bg-bg cursor-pointer">
                            {uploadingTypeId === t.id ? m.uploading : m.uploadImages}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                uploadImages(t.id, e.target.files);
                                e.currentTarget.value = "";
                              }}
                              disabled={uploadingTypeId === t.id}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl border p-3">
                          <div className="text-sm font-semibold text-primary mb-2">{m.seasonalPricing}</div>
                          <div className="flex flex-col gap-2">
                            {t.seasonalRates.length ? (
                              t.seasonalRates.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs border rounded-xl px-2 py-1">
                                  <div>
                                    {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
                                  </div>
                                  <div className="font-semibold">{r.pricePerNight} {m.sar}</div>
                                  <button
                                    disabled={seasonSavingId === r.id}
                                    onClick={() => deleteSeasonalRate(r.id)}
                                    className="px-2 py-1 rounded-lg border text-[10px]"
                                  >
                                    {m.deleteRule}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500">{locale === "ar" ? "لا توجد أسعار موسمية" : "No seasonal rates"}</div>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="date"
                              dir="ltr"
                              value={seasonDraft.startDate}
                              onChange={(e) => setSeasonEdits((prev) => ({ ...prev, [t.id]: { ...seasonDraft, startDate: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                            <input
                              type="date"
                              dir="ltr"
                              value={seasonDraft.endDate}
                              onChange={(e) => setSeasonEdits((prev) => ({ ...prev, [t.id]: { ...seasonDraft, endDate: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                            <input
                              type="number"
                              min="0"
                              dir="ltr"
                              value={seasonDraft.price}
                              onChange={(e) => setSeasonEdits((prev) => ({ ...prev, [t.id]: { ...seasonDraft, price: e.target.value } }))}
                              placeholder={m.pricePerNight}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                          </div>
                          <button
                            disabled={seasonSavingId === t.id}
                            onClick={() => addSeasonalRate(t.id)}
                            className="mt-2 px-3 py-2 rounded-xl bg-primary text-white text-xs"
                          >
                            {seasonSavingId === t.id ? m.saving : m.addSeasonalRate}
                          </button>
                        </div>

                        <div className="rounded-2xl border p-3">
                          <div className="text-sm font-semibold text-primary mb-2">{m.minStay}</div>
                          <div className="flex flex-col gap-2">
                            {t.minStayRules.length ? (
                              t.minStayRules.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs border rounded-xl px-2 py-1">
                                  <div>
                                    {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
                                  </div>
                                  <div className="font-semibold">{r.minNights} {m.minNights}</div>
                                  <button
                                    disabled={minStaySavingId === r.id}
                                    onClick={() => deleteMinStayRule(r.id)}
                                    className="px-2 py-1 rounded-lg border text-[10px]"
                                  >
                                    {m.deleteRule}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500">{locale === "ar" ? "لا توجد شروط" : "No rules"}</div>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="date"
                              dir="ltr"
                              value={minStayDraft.startDate}
                              onChange={(e) => setMinStayEdits((prev) => ({ ...prev, [t.id]: { ...minStayDraft, startDate: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                            <input
                              type="date"
                              dir="ltr"
                              value={minStayDraft.endDate}
                              onChange={(e) => setMinStayEdits((prev) => ({ ...prev, [t.id]: { ...minStayDraft, endDate: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                            <input
                              type="number"
                              min="1"
                              dir="ltr"
                              value={minStayDraft.nights}
                              onChange={(e) => setMinStayEdits((prev) => ({ ...prev, [t.id]: { ...minStayDraft, nights: e.target.value } }))}
                              placeholder={m.minNights}
                              className="px-3 py-2 rounded-xl border text-left text-xs"
                            />
                          </div>
                          <button
                            disabled={minStaySavingId === t.id}
                            onClick={() => addMinStayRule(t.id)}
                            className="mt-2 px-3 py-2 rounded-xl bg-primary text-white text-xs"
                          >
                            {minStaySavingId === t.id ? m.saving : m.addMinStayRule}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {unitTypeCards.length === 0 ? (
                  <div className="text-sm text-gray-600">{locale === "ar" ? "لا توجد أنواع" : "No unit types"}</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl bg-white border shadow-sm p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-primary">{m.units}</h2>
                  <p className="text-xs text-gray-500">{m.manageUnitsHint}</p>
                </div>
                <button onClick={resetUnitFilters} className="px-3 py-2 rounded-xl border text-sm hover:bg-bg">
                  {m.resetFilters}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <label className="text-sm text-gray-700">
                  {m.search}
                  <input
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder={m.unitSearchPlaceholder}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  {m.statusFilter}
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                    <option value="all">{m.all}</option>
                    <option value="active">{m.active}</option>
                    <option value="inactive">{m.inactive}</option>
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
                  {m.floor}
                  <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                    <option value="all">{m.all}</option>
                    {floorOptions.map((f) => (
                      <option key={f} value={String(f)}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-700">
                  {m.sort}
                  <select value={unitSort} onChange={(e) => setUnitSort(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                    <option value="numberAsc">{m.sortNumberAsc}</option>
                    <option value="numberDesc">{m.sortNumberDesc}</option>
                    <option value="floorAsc">{m.sortFloorAsc}</option>
                    <option value="floorDesc">{m.sortFloorDesc}</option>
                  </select>
                </label>
                <label className="text-sm text-gray-700 flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={groupByFloor}
                    onChange={(e) => setGroupByFloor(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>{m.groupByFloor}</span>
                </label>
              </div>

              <div className="mt-3 text-xs text-gray-600">
                {m.showing} {sortedUnits.length} / {units.length}
              </div>
            </div>

            {groupByFloor ? (
              <div className="grid gap-4">
                {groupedUnits.map((group) => (
                  <div key={group.floor} className="rounded-3xl bg-white border shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-primary">
                        {m.floor} {group.floor}
                      </div>
                      <div className="text-xs text-gray-500">{group.units.length}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.units.map((u) => renderUnitCard(u))}
                    </div>
                  </div>
                ))}
                {sortedUnits.length === 0 ? (
                  <div className="text-sm text-gray-600">{locale === "ar" ? "لا توجد وحدات مطابقة" : "No matching units"}</div>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedUnits.map((u) => renderUnitCard(u))}
                {sortedUnits.length === 0 ? (
                  <div className="text-sm text-gray-600">{locale === "ar" ? "لا توجد وحدات مطابقة" : "No matching units"}</div>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-4">
            <div className="rounded-3xl bg-white border shadow-sm p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">{m.blocks}</h2>
                  <p className="text-xs text-gray-500">{m.addBlockHint}</p>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <label className="text-sm text-gray-700">
                    {m.search}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        value={blockSearch}
                        onChange={(e) => setBlockSearch(e.target.value)}
                        placeholder={m.blockSearchPlaceholder}
                        className="w-full md:w-64 px-3 py-2 rounded-xl border"
                      />
                      {blockSearch ? (
                        <button onClick={() => setBlockSearch("")} className="px-3 py-2 rounded-xl border text-xs hover:bg-bg">
                          {m.clear}
                        </button>
                      ) : null}
                    </div>
                  </label>
                  <label className="text-sm text-gray-700">
                    {m.sort}
                    <select value={blockSort} onChange={(e) => setBlockSort(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                      <option value="newest">{m.newest}</option>
                      <option value="oldest">{m.oldest}</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                {m.showing} {filteredBlocks.length} / {blocks.length}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,1.9fr] gap-4">
              <div className="rounded-3xl bg-white border shadow-sm p-4">
                <h3 className="text-base font-bold text-primary mb-3">{m.blockDates}</h3>
                <form onSubmit={addBlock} className="grid gap-3">
                  <label className="text-sm text-gray-700">
                    {m.unit}
                    <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border">
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="text-sm text-gray-700">
                      {m.fromDate}
                      <input type="date" dir="ltr" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`mt-1 w-full ${dateInputClass}`} required />
                    </label>
                    <label className="text-sm text-gray-700">
                      {m.toDate}
                      <input type="date" dir="ltr" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`mt-1 w-full ${dateInputClass}`} required />
                    </label>
                  </div>
                  <label className="text-sm text-gray-700">
                    {m.reason}
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border" />
                  </label>
                  <button disabled={saving} className="px-4 py-3 rounded-2xl bg-accent text-white font-semibold">
                    {m.addBlock}
                  </button>
                </form>
              </div>

              <div className="rounded-3xl bg-white border shadow-sm overflow-hidden">
                <div className="overflow-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-bg border-b">
                      <tr className="text-gray-700">
                        <th className="p-3 text-left">{m.unit}</th>
                        <th className="p-3 text-left">{m.fromDate}</th>
                        <th className="p-3 text-left">{m.toDate}</th>
                        <th className="p-3 text-left">{m.reason}</th>
                        <th className="p-3 text-left">{m.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBlocks.map((b) => {
                        const start = new Date(b.startDate).getTime();
                        const end = new Date(b.endDate).getTime();
                        const isActive = start <= nowTs && end > nowTs;
                        return (
                          <tr key={b.id} className={`border-b last:border-0 ${isActive ? "bg-amber-50/60" : ""}`}>
                            <td className="p-3">
                              <div className="font-semibold text-primary">
                                {locale === "ar" ? b.unit.unitType.nameAr : b.unit.unitType.nameEn}
                              </div>
                      <div className="text-xs text-gray-600">#{b.unit.number} ({floorTag(b.unit.floor)})</div>
                            </td>
                            <td className="p-3">{new Date(b.startDate).toISOString().slice(0, 10)}</td>
                            <td className="p-3">{new Date(b.endDate).toISOString().slice(0, 10)}</td>
                            <td className="p-3">{b.reason || "—"}</td>
                            <td className="p-3">
                              <button
                                disabled={saving}
                                onClick={() => removeBlock(b.id)}
                                className="px-3 py-1 rounded-xl border text-xs hover:bg-bg"
                              >
                                {m.deleteBlock}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredBlocks.length === 0 ? (
                        <tr>
                          <td className="p-6 text-center text-gray-600" colSpan={4}>
                            {locale === "ar" ? "لا توجد تواريخ محجوبة" : "No blocked dates yet"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function AdminAvailability() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AdminAvailabilityContent />
    </Suspense>
  );
}
