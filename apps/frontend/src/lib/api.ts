const isServer = typeof window === "undefined";
const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE || (isServer ? "http://localhost:4000" : "");
const INTERNAL_API_BASE = process.env.API_INTERNAL_BASE || PUBLIC_API_BASE;

export const API_BASE = isServer ? INTERNAL_API_BASE : PUBLIC_API_BASE;

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export type BookingChannel = "WEBSITE" | "PHONE" | "AGENCY" | "OTA";
export type PaymentMethod = "UNSPECIFIED" | "CASH" | "CARD" | "MADA" | "VISA" | "TRANSFER";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
export type InvoiceStatus = "NOT_ISSUED" | "ISSUED" | "VOID";
export type BookingRequestType = "UPGRADE" | "EARLY_CHECKIN" | "LATE_CHECKOUT" | "OTHER";
export type BookingRequestStatus = "PENDING" | "AWAITING_CUSTOMER" | "APPROVED" | "REJECTED";

export type UnitImage = {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type UnitPhoto = {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type SeasonalRate = {
  id: string;
  startDate: string;
  endDate: string;
  pricePerNight: number;
};

export type MinStayRule = {
  id: string;
  startDate: string;
  endDate: string;
  minNights: number;
};

export type PriceSummary = {
  nights: number;
  total: number;
  avgNightly: number;
  minNightly: number;
  maxNightly: number;
};

export type SiteSettings = {
  heroImageUrl?: string;
};

export type UnitType = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  bedrooms: number;
  hasMajlis: boolean;
  kitchen: string;
  descriptionAr: string;
  descriptionEn: string;
  basePrice: number;
  imageUrl?: string | null;
  images?: UnitImage[];
  floors?: number[];
  availableCount?: number | null;
  priceSummary?: PriceSummary | null;
  minNights?: number | null;
  seasonalRates?: SeasonalRate[];
  minStayRules?: MinStayRule[];
};

export async function getUnitTypes(params?: { checkIn?: string; checkOut?: string; floor?: string | number }) {
  const q = new URLSearchParams();
  if (params?.checkIn) q.set("checkIn", params.checkIn);
  if (params?.checkOut) q.set("checkOut", params.checkOut);
  if (params?.floor !== undefined && params?.floor !== null && params?.floor !== "") q.set("floor", String(params.floor));
  const res = await fetch(`${API_BASE}/api/public/unit-types?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load unit types");
  return (await res.json()) as UnitType[];
}

export async function getPublicSettings() {
  const res = await fetch(`${API_BASE}/api/public/settings`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load settings");
  return (await res.json()) as SiteSettings;
}

export async function getUnitType(id: string, params?: { checkIn?: string; checkOut?: string }) {
  const q = new URLSearchParams();
  if (params?.checkIn) q.set("checkIn", params.checkIn);
  if (params?.checkOut) q.set("checkOut", params.checkOut);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const res = await fetch(`${API_BASE}/api/public/unit-types/${id}${suffix}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Not found");
  return (await res.json()) as UnitType;
}

export async function createBooking(payload: {
  unitTypeId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestsCount: number;
  notes?: string;
  floor?: number | string;
  channel?: BookingChannel;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  invoiceStatus?: InvoiceStatus;
  nationality?: string;
}) {
  const res = await fetch(`${API_BASE}/api/public/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Booking failed");
  return data as { id: string; bookingCode?: string | null };
}

export async function publicLookupBooking(payload: { bookingId: string; identifier: string }) {
  const res = await fetch(`${API_BASE}/api/public/booking-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Lookup failed");
  return data as { booking: any; requests: any[] };
}

export async function publicCreateBookingRequest(payload: {
  bookingId: string;
  identifier: string;
  type: BookingRequestType;
  message?: string;
}) {
  const res = await fetch(`${API_BASE}/api/public/booking-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as any;
}

export async function publicRespondToBookingRequest(payload: {
  bookingId: string;
  identifier: string;
  requestId: string;
  message: string;
}) {
  const res = await fetch(`${API_BASE}/api/public/booking-requests/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to send response");
  return data as any;
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Login failed");
  return data as { token: string; permissions?: string[]; isSuperAdmin?: boolean };
}

export async function adminGetBookings(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load bookings");
  return await res.json();
}

export async function adminGetBookingRequests(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/booking-requests`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load requests");
  return await res.json();
}

export async function adminUpdateBookingRequest(
  token: string,
  id: string,
  payload: { status?: BookingRequestStatus; responseMessage?: string | null }
) {
  const res = await fetch(`${API_BASE}/api/admin/booking-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update request");
  return data;
}

export async function adminGetSettings(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load settings");
  return (await res.json()) as SiteSettings;
}

export async function adminUpdateSettings(token: string, payload: { heroImageUrl?: string | null }) {
  const res = await fetch(`${API_BASE}/api/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update settings");
  return data as SiteSettings;
}

export async function adminAddSeasonalRate(
  token: string,
  unitTypeId: string,
  payload: { startDate: string; endDate: string; pricePerNight: number }
) {
  const res = await fetch(`${API_BASE}/api/admin/unit-types/${unitTypeId}/seasonal-rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to add seasonal rate");
  return data;
}

export async function adminDeleteSeasonalRate(token: string, rateId: string) {
  const res = await fetch(`${API_BASE}/api/admin/seasonal-rates/${rateId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to delete seasonal rate");
  return await res.json();
}

export async function adminAddMinStayRule(
  token: string,
  unitTypeId: string,
  payload: { startDate: string; endDate: string; minNights: number }
) {
  const res = await fetch(`${API_BASE}/api/admin/unit-types/${unitTypeId}/min-stay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to add min-stay");
  return data;
}

export async function adminDeleteMinStayRule(token: string, ruleId: string) {
  const res = await fetch(`${API_BASE}/api/admin/min-stay/${ruleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to delete min-stay");
  return await res.json();
}

export async function adminSetBookingStatus(token: string, id: string, status: BookingStatus) {
  const res = await fetch(`${API_BASE}/api/admin/bookings/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("Failed to update");
  return await res.json();
}

export async function adminGetAvailableUnits(token: string, bookingId: string, unitTypeId?: string) {
  const q = unitTypeId ? `?unitTypeId=${encodeURIComponent(unitTypeId)}` : "";
  const res = await fetch(`${API_BASE}/api/admin/bookings/${bookingId}/available-units${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load units");
  return await res.json();
}

export async function adminSetBookingUnit(token: string, bookingId: string, unitId: string) {
  const res = await fetch(`${API_BASE}/api/admin/bookings/${bookingId}/unit`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ unitId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update unit");
  return data;
}

export async function adminGetUnits(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/units`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load units");
  return await res.json();
}

export async function adminAddUnitPhoto(token: string, unitId: string, payload: { url: string; isPrimary?: boolean; sortOrder?: number }) {
  const res = await fetch(`${API_BASE}/api/admin/units/${unitId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to add photo");
  return data;
}

export async function adminSetUnitPhotoPrimary(token: string, photoId: string) {
  const res = await fetch(`${API_BASE}/api/admin/unit-photos/${photoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isPrimary: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update photo");
  return data;
}

export async function adminDeleteUnitPhoto(token: string, photoId: string) {
  const res = await fetch(`${API_BASE}/api/admin/unit-photos/${photoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to delete photo");
  return await res.json();
}

export async function adminGetUnitTypes(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/unit-types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load unit types");
  return await res.json();
}

export async function adminUpdateUnitType(
  token: string,
  id: string,
  payload: { basePrice?: number; nameAr?: string; nameEn?: string; descriptionAr?: string; descriptionEn?: string; imageUrl?: string | null }
) {
  const res = await fetch(`${API_BASE}/api/admin/unit-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update unit type");
  return data;
}

export async function adminSetUnitActive(token: string, id: string, isActive: boolean) {
  const res = await fetch(`${API_BASE}/api/admin/units/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isActive })
  });
  if (!res.ok) throw new Error("Failed to update unit");
  return await res.json();
}

export async function adminCreateBlock(token: string, payload: { unitId: string; startDate: string; endDate: string; reason?: string }) {
  const res = await fetch(`${API_BASE}/api/admin/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to create block");
  return data;
}

export async function adminGetBlocks(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/blocks`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load blocks");
  return await res.json();
}

export async function adminUploadImage(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Upload failed");
  return data as { url: string };
}

export async function adminAddUnitImage(token: string, unitTypeId: string, url: string, isPrimary?: boolean) {
  const res = await fetch(`${API_BASE}/api/admin/unit-types/${unitTypeId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, isPrimary })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to add image");
  return data;
}

export async function adminSetUnitImagePrimary(token: string, imageId: string) {
  const res = await fetch(`${API_BASE}/api/admin/unit-images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isPrimary: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to set primary");
  return data;
}

export async function adminDeleteUnitImage(token: string, imageId: string) {
  const res = await fetch(`${API_BASE}/api/admin/unit-images/${imageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to delete image");
  return data as { id: string };
}

export async function adminDeleteBlock(token: string, id: string) {
  const res = await fetch(`${API_BASE}/api/admin/blocks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to delete block");
  return data as { id: string };
}

export type AdminUser = {
  id: string;
  email: string;
  permissions: string[];
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function adminGetUsers(token: string) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load users");
  return (await res.json()) as AdminUser[];
}

export async function adminCreateUser(token: string, payload: {
  email: string;
  password: string;
  permissions: string[];
  isActive?: boolean;
}) {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    const issueMessage = data?.issues?.[0]?.message;
    throw new Error(issueMessage || data?.message || "Failed to create user");
  }
  return data as AdminUser;
}

export async function adminUpdateUser(token: string, id: string, payload: {
  permissions?: string[];
  isActive?: boolean;
  password?: string;
}) {
  const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    const issueMessage = data?.issues?.[0]?.message;
    throw new Error(issueMessage || data?.message || "Failed to update user");
  }
  return data as AdminUser;
}
