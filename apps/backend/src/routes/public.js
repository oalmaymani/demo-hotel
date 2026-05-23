import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { applyLoyaltyDiscount, getRepeatCustomerBookings } from '../utils/loyalty.js';
import { parseISODateOnly } from '../utils/dates.js';
import { countAvailableUnitsForType, findAvailableUnitForType } from '../services/availability.js';

export const publicRouter = Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function diffNights(checkIn, checkOut) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '');
}

function matchesIdentifier(booking, identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower.includes('@')) {
    return booking.guestEmail && booking.guestEmail.toLowerCase() === lower;
  }
  const inputDigits = normalizePhone(raw);
  const bookingDigits = normalizePhone(booking.guestPhone);
  if (!inputDigits || !bookingDigits) return false;
  return bookingDigits === inputDigits || bookingDigits.endsWith(inputDigits);
}

async function generateBookingCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await prisma.booking.findUnique({ where: { bookingCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  return String(Date.now()).slice(-8);
}

function buildPriceSummary({ basePrice, checkIn, checkOut, rates }) {
  const nights = diffNights(checkIn, checkOut);
  if (nights <= 0) return null;

  let total = 0;
  let minNightly = Number.POSITIVE_INFINITY;
  let maxNightly = 0;
  const cursor = new Date(checkIn.getTime());

  while (cursor < checkOut) {
    const rate = rates.find((r) => cursor >= r.startDate && cursor < r.endDate);
    const price = rate ? rate.pricePerNight : basePrice;
    total += price;
    if (price < minNightly) minNightly = price;
    if (price > maxNightly) maxNightly = price;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    nights,
    total,
    avgNightly: Math.round(total / nights),
    minNightly: Number.isFinite(minNightly) ? minNightly : basePrice,
    maxNightly: maxNightly || basePrice
  };
}

async function getSeasonalRatesForRange(unitTypeId, checkIn, checkOut) {
  return prisma.seasonalRate.findMany({
    where: {
      unitTypeId,
      startDate: { lt: checkOut },
      endDate: { gt: checkIn }
    },
    orderBy: [{ createdAt: 'desc' }]
  });
}

async function getMinNightsForRange(unitTypeId, checkIn, checkOut) {
  const rules = await prisma.minStayRule.findMany({
    where: {
      unitTypeId,
      startDate: { lt: checkOut },
      endDate: { gt: checkIn }
    }
  });
  if (!rules.length) return null;
  return Math.max(...rules.map((r) => r.minNights));
}

publicRouter.get('/unit-types', asyncHandler(async (req, res) => {
  const checkIn = req.query.checkIn ? parseISODateOnly(req.query.checkIn) : null;
  const checkOut = req.query.checkOut ? parseISODateOnly(req.query.checkOut) : null;
  const floorParam = req.query.floor;
  const floorTokens = Array.isArray(floorParam)
    ? floorParam
    : floorParam
      ? String(floorParam).split(',')
      : [];
  const floors = floorTokens.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  const floorsFilter = floors.length > 0 ? floors : null;

  const types = await prisma.unitType.findMany({
    orderBy: { code: 'asc' },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      units: { where: { isActive: true }, select: { floor: true } }
    }
  });

  if (checkIn && checkOut) {
    const enriched = [];
    for (const t of types) {
      const availableCount = await countAvailableUnitsForType({ unitTypeId: t.id, checkIn, checkOut, floors: floorsFilter });
      const floorList = Array.from(new Set(t.units.map((u) => u.floor))).sort((a, b) => a - b);
      const rates = await getSeasonalRatesForRange(t.id, checkIn, checkOut);
      const priceSummary = buildPriceSummary({ basePrice: t.basePrice, checkIn, checkOut, rates });
      const minNights = await getMinNightsForRange(t.id, checkIn, checkOut);
      const { units, ...rest } = t;
      enriched.push({ ...rest, floors: floorList, availableCount, priceSummary, minNights });
    }
    return res.json(enriched);
  }

  return res.json(types.map((t) => {
    const floorList = Array.from(new Set(t.units.map((u) => u.floor))).sort((a, b) => a - b);
    const { units, ...rest } = t;
    return { ...rest, floors: floorList, availableCount: null };
  }));
}));

publicRouter.get('/settings', asyncHandler(async (_req, res) => {
  const rows = await prisma.siteSetting.findMany();
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  res.json(settings);
}));

publicRouter.get('/unit-types/:id', asyncHandler(async (req, res) => {
  const checkIn = req.query.checkIn ? parseISODateOnly(req.query.checkIn) : null;
  const checkOut = req.query.checkOut ? parseISODateOnly(req.query.checkOut) : null;
  const t = await prisma.unitType.findUnique({
    where: { id: req.params.id },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      units: { where: { isActive: true }, select: { floor: true } }
    }
  });
  if (!t) return res.status(404).json({ message: 'Not found' });
  const floorList = Array.from(new Set(t.units.map((u) => u.floor))).sort((a, b) => a - b);
  const { units, ...rest } = t;
  if (checkIn && checkOut) {
    const rates = await getSeasonalRatesForRange(t.id, checkIn, checkOut);
    const priceSummary = buildPriceSummary({ basePrice: t.basePrice, checkIn, checkOut, rates });
    const minNights = await getMinNightsForRange(t.id, checkIn, checkOut);
    return res.json({ ...rest, floors: floorList, priceSummary, minNights });
  }
  res.json({ ...rest, floors: floorList });
}));

publicRouter.post('/bookings', asyncHandler(async (req, res) => {
  const schema = z.object({
    unitTypeId: z.string().min(1),
    checkIn: z.string().min(10),
    checkOut: z.string().min(10),
    guestName: z.string().min(2),
    guestPhone: z.string().min(8),
    guestEmail: z.string().email(),
    guestsCount: z.number().int().min(1).max(20).default(1),
    notes: z.string().max(500).optional(),
    floor: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : Number(v)),
      z.number().int().optional()
    ),
    channel: z.enum(["WEBSITE", "PHONE", "AGENCY", "OTA"]).optional(),
    paymentMethod: z.enum(["UNSPECIFIED", "CASH", "CARD", "MADA", "VISA", "TRANSFER"]).optional(),
    paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]).optional(),
    invoiceStatus: z.enum(["NOT_ISSUED", "ISSUED", "VOID"]).optional(),
    nationality: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().max(80).optional()
    )
  });

  const data = schema.safeParse(req.body);
  if (!data.success) return res.status(400).json({ message: 'Invalid payload', issues: data.error.issues });

  const checkIn = parseISODateOnly(data.data.checkIn);
  const checkOut = parseISODateOnly(data.data.checkOut);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return res.status(400).json({ message: 'Invalid dates' });
  }

  const unitType = await prisma.unitType.findUnique({ where: { id: data.data.unitTypeId } });
  if (!unitType) return res.status(404).json({ message: 'Unit type not found' });

  const floors = data.data.floor ? [data.data.floor] : null;
  const minNights = await getMinNightsForRange(unitType.id, checkIn, checkOut);
  const nights = diffNights(checkIn, checkOut);
  if (minNights && nights < minNights) {
    return res.status(400).json({ message: `Minimum stay is ${minNights} nights` });
  }

  const unitId = await findAvailableUnitForType({ unitTypeId: unitType.id, checkIn, checkOut, floors });
  if (!unitId) return res.status(409).json({ message: 'No availability for these dates' });

  const rates = await getSeasonalRatesForRange(unitType.id, checkIn, checkOut);
  const priceSummary = buildPriceSummary({ basePrice: unitType.basePrice, checkIn, checkOut, rates });
  const baseTotal = priceSummary?.total ?? unitType.basePrice * nights;
  let discountPercent = null;
  let discountAmount = null;
  let totalAmount = baseTotal;
  let loyaltyRateApplied = null;
  let loyaltyDiscountAmount = null;
  if (data.data.guestPhone) {
    const priorConfirmedCount = await getRepeatCustomerBookings(data.data.guestPhone, null);
    const res = await applyLoyaltyDiscount({ totalAmount: baseTotal }, data.data.guestPhone, priorConfirmedCount);
    if (res.discountPercent > 0 && res.discountAmount > 0) {
      discountPercent = res.discountPercent;
      discountAmount = res.discountAmount;
      totalAmount = Math.max(0, baseTotal - discountAmount);
      loyaltyRateApplied = res.discountPercent;
      loyaltyDiscountAmount = res.discountAmount;
    }
  }

  const bookingCode = await generateBookingCode();
  const booking = await prisma.booking.create({
    data: {
      bookingCode,
      unitId,
      unitTypeId: unitType.id,
      guestName: data.data.guestName,
      guestPhone: data.data.guestPhone,
      guestEmail: data.data.guestEmail,
      guestsCount: data.data.guestsCount,
      notes: data.data.notes,
      checkIn,
      checkOut,
      status: 'PENDING',
      channel: data.data.channel ?? 'WEBSITE',
      paymentMethod: data.data.paymentMethod ?? 'UNSPECIFIED',
      paymentStatus: data.data.paymentStatus ?? 'UNPAID',
      invoiceStatus: data.data.invoiceStatus ?? 'NOT_ISSUED',
      nationality: data.data.nationality,
      totalAmount,
      discountPercent,
      discountAmount,
      loyaltyRateApplied,
      loyaltyDiscountAmount,
      loyaltyAppliedAt: loyaltyRateApplied ? new Date() : undefined
    }
  });
  res.status(201).json({ id: booking.id, bookingCode: booking.bookingCode });
}));

publicRouter.post('/booking-lookup', asyncHandler(async (req, res) => {
  const schema = z.object({
    bookingId: z.string().min(4),
    identifier: z.string().min(3)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const bookingKey = parsed.data.bookingId.trim();
  let booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { id: bookingKey },
        { bookingCode: bookingKey }
      ]
    },
    include: {
      unit: { select: { number: true, floor: true } },
      unitType: { select: { nameAr: true, nameEn: true } },
      requests: { orderBy: { createdAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'asc' } } } }
    }
  });
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (booking.status !== 'CONFIRMED') return res.status(404).json({ message: 'Not found' });
  if (!matchesIdentifier(booking, parsed.data.identifier)) {
    return res.status(404).json({ message: 'Not found' });
  }

  if (!booking.discountPercent && typeof booking.totalAmount === 'number' && booking.guestPhone) {
    const priorConfirmed = await prisma.booking.findFirst({
      where: {
        guestPhone: booking.guestPhone,
        status: 'CONFIRMED',
        id: { not: booking.id },
        createdAt: { lt: booking.createdAt }
      },
      select: { id: true }
    });
    if (priorConfirmed) {
      const discountPercent = 15;
      const discountAmount = Math.round(booking.totalAmount * 0.15);
      const totalAmount = Math.max(0, booking.totalAmount - discountAmount);
      booking = await prisma.booking.update({
        where: { id: booking.id },
        data: { discountPercent, discountAmount, totalAmount },
        include: {
          unit: { select: { number: true, floor: true } },
          unitType: { select: { nameAr: true, nameEn: true } },
          requests: { orderBy: { createdAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'asc' } } } }
        }
      });
    }
  }

  res.json({
    booking: {
      id: booking.id,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guestEmail: booking.guestEmail,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
      totalAmount: booking.totalAmount,
      discountPercent: booking.discountPercent,
      discountAmount: booking.discountAmount,
      unit: booking.unit,
      unitType: booking.unitType
    },
    requests: booking.requests
  });
}));

publicRouter.post('/booking-requests', asyncHandler(async (req, res) => {
  const schema = z.object({
    bookingId: z.string().min(4),
    identifier: z.string().min(3),
    type: z.enum(['UPGRADE', 'EARLY_CHECKIN', 'LATE_CHECKOUT', 'OTHER']),
    message: z.string().max(500).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const bookingKey = parsed.data.bookingId.trim();
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { id: bookingKey },
        { bookingCode: bookingKey }
      ]
    }
  });
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (booking.status !== 'CONFIRMED') return res.status(404).json({ message: 'Not found' });
  if (!matchesIdentifier(booking, parsed.data.identifier)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const request = await prisma.bookingRequest.create({
    data: {
      bookingId: booking.id,
      type: parsed.data.type,
      message: parsed.data.message
    }
  });

  if (parsed.data.message) {
    await prisma.bookingRequestMessage.create({
      data: {
        requestId: request.id,
        actor: 'CUSTOMER',
        message: parsed.data.message
      }
    });
  }

  res.status(201).json(request);
}));

publicRouter.post('/booking-requests/respond', asyncHandler(async (req, res) => {
  const schema = z.object({
    bookingId: z.string().min(4),
    identifier: z.string().min(3),
    requestId: z.string().min(6),
    message: z.string().max(500)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const bookingKey = parsed.data.bookingId.trim();
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { id: bookingKey },
        { bookingCode: bookingKey }
      ]
    }
  });
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (booking.status !== 'CONFIRMED') return res.status(404).json({ message: 'Not found' });
  if (!matchesIdentifier(booking, parsed.data.identifier)) {
    return res.status(404).json({ message: 'Not found' });
  }

  const request = await prisma.bookingRequest.findFirst({
    where: { id: parsed.data.requestId, bookingId: booking.id }
  });
  if (!request) return res.status(404).json({ message: 'Not found' });
  if (request.status !== 'AWAITING_CUSTOMER') {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const updated = await prisma.bookingRequest.update({
    where: { id: request.id },
    data: {
      customerResponse: parsed.data.message,
      customerRespondedAt: new Date(),
      status: 'PENDING'
    }
  });

  await prisma.bookingRequestMessage.create({
    data: {
      requestId: updated.id,
      actor: 'CUSTOMER',
      message: parsed.data.message
    }
  });

  res.json(updated);
}));
