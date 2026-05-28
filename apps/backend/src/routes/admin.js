import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../db.js';
import { parseISODateOnly } from '../utils/dates.js';
import { requireAdmin, requirePermission, signAdminToken } from '../utils/auth.js';
import { sendBookingConfirmedEmail } from '../services/email.js';
import { applyLoyaltyDiscount, getRepeatCustomerBookings } from '../utils/loyalty.js';
import { getLoyaltyProgram } from '../utils/loyalty.js';

export const adminRouter = Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const uploadsDir = path.resolve('uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext && ext.length <= 8 ? ext : '';
      const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only images are allowed'));
  }
});

const permissionEnum = z.enum([
  'bookings:view',
  'bookings:status',
  'bookings:unit',
  'requests:manage',
  'users:manage'
]);

adminRouter.post('/auth/login', asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  if (!user.isActive) return res.status(403).json({ message: 'User is disabled' });

  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signAdminToken({
    sub: user.id,
    email: user.email,
    role: 'admin',
    permissions: user.permissions || [],
    isSuperAdmin: user.isSuperAdmin || false
  });
  res.json({ token, permissions: user.permissions || [], isSuperAdmin: user.isSuperAdmin || false });
}));

adminRouter.get('/users', requirePermission('users:manage'), asyncHandler(async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, permissions: true, isSuperAdmin: true, isActive: true, createdAt: true, updatedAt: true }
  });
  res.json(users);
}));

adminRouter.post('/users', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    permissions: z.array(permissionEnum).default([]),
    isActive: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  if (parsed.data.isSuperAdmin && !req.admin?.isSuperAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      password: hashed,
      permissions: parsed.data.permissions || [],
      isActive: parsed.data.isActive ?? true,
      isSuperAdmin: parsed.data.isSuperAdmin ?? false
    },
    select: { id: true, email: true, permissions: true, isSuperAdmin: true, isActive: true, createdAt: true, updatedAt: true }
  });
  res.status(201).json(created);
}));

adminRouter.patch('/users/:id', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const schema = z.object({
    permissions: z.array(permissionEnum).optional(),
    isActive: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional(),
    password: z.string().min(6).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });
  if (Object.keys(parsed.data).length === 0) return res.status(400).json({ message: 'No updates provided' });

  if (parsed.data.isSuperAdmin !== undefined && !req.admin?.isSuperAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updates = { ...parsed.data };
  if (parsed.data.password) {
    updates.password = await bcrypt.hash(parsed.data.password, 10);
  }

  const updated = await prisma.adminUser.update({
    where: { id: req.params.id },
    data: updates,
    select: { id: true, email: true, permissions: true, isSuperAdmin: true, isActive: true, createdAt: true, updatedAt: true }
  });

  res.json(updated);
}));

adminRouter.post('/uploads', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(201).json({ url });
}));

adminRouter.get('/settings', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await prisma.siteSetting.findMany();
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  res.json(settings);
}));

adminRouter.patch('/settings', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    heroImageUrl: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().url().nullable().optional()
    )
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const updates = parsed.data;
  if (updates.heroImageUrl !== undefined) {
    if (updates.heroImageUrl === null) {
      await prisma.siteSetting.deleteMany({ where: { key: 'heroImageUrl' } });
    } else {
      await prisma.siteSetting.upsert({
        where: { key: 'heroImageUrl' },
        create: { key: 'heroImageUrl', value: updates.heroImageUrl },
        update: { value: updates.heroImageUrl }
      });
    }
  }

  const rows = await prisma.siteSetting.findMany();
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  res.json(settings);
}));

adminRouter.get('/bookings', requirePermission('bookings:view'), asyncHandler(async (_req, res) => {
  const bookingsAsc = await prisma.booking.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      unit: { select: { id: true, number: true, floor: true, isActive: true } },
      unitType: { select: { code: true, nameAr: true, nameEn: true, bedrooms: true, kitchen: true } },
      requests: { where: { type: 'UPGRADE', status: 'APPROVED' }, select: { id: true } }
    }
  });
  const seenConfirmed = new Set();
  const updates = [];

  for (const booking of bookingsAsc) {
    const phone = booking.guestPhone;
    if (booking.status !== 'CONFIRMED' || !phone) continue;

    if (seenConfirmed.has(phone)) {
      if (!booking.discountPercent && typeof booking.totalAmount === 'number') {
        const priorCount = await getRepeatCustomerBookings(phone, booking.id);
        const { discountPercent, discountAmount } = await applyLoyaltyDiscount(booking, phone, priorCount);
        
        if (discountPercent > 0 && discountAmount > 0) {
          const totalAmount = Math.max(0, booking.totalAmount - discountAmount);
          updates.push(prisma.booking.update({
            where: { id: booking.id },
            data: { discountPercent, discountAmount, totalAmount }
          }));
          booking.discountPercent = discountPercent;
          booking.discountAmount = discountAmount;
          booking.totalAmount = totalAmount;
        }
      }
    }

    seenConfirmed.add(phone);
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  const bookings = [...bookingsAsc].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(bookings);
}));

adminRouter.patch('/bookings/:id/status', requirePermission('bookings:status'), asyncHandler(async (req, res) => {
  const schema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const existing = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      unit: { select: { id: true, number: true, floor: true, isActive: true } },
      unitType: { select: { nameAr: true, nameEn: true } }
    }
  });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  const shouldApplyDiscount = (
    parsed.data.status === 'CONFIRMED' &&
    existing.status !== 'CONFIRMED' &&
    !existing.discountPercent &&
    typeof existing.totalAmount === 'number' &&
    existing.guestPhone
  );

  let discountData = {};
  if (shouldApplyDiscount) {
    const priorConfirmedCount = await getRepeatCustomerBookings(existing.guestPhone, existing.id);
    
    if (priorConfirmedCount > 0) {
      const { discountPercent, discountAmount } = await applyLoyaltyDiscount(existing, existing.guestPhone, priorConfirmedCount);
      
      if (discountPercent > 0 && discountAmount > 0) {
        const totalAmount = Math.max(0, existing.totalAmount - discountAmount);
        discountData = { discountPercent, discountAmount, totalAmount };
      }
    }
  }

  const booking = await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status, ...discountData },
    include: {
      unit: { select: { id: true, number: true, floor: true, isActive: true } },
      unitType: { select: { code: true, nameAr: true, nameEn: true, bedrooms: true, kitchen: true } }
    }
  });

  if (parsed.data.status === 'CONFIRMED' && existing.status !== 'CONFIRMED' && existing.guestEmail) {
    sendBookingConfirmedEmail({ to: existing.guestEmail, booking: existing })
      .catch((err) => console.error('SendGrid error', err));
  }

  res.json({ id: booking.id, status: booking.status });
}));

// Update or remove loyalty snapshot/discount for a booking
adminRouter.patch('/bookings/:id/loyalty', requirePermission('bookings:status'), asyncHandler(async (req, res) => {
  const schema = z.object({ action: z.enum(['remove', 'set']), rate: z.number().int().min(0).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  // Derive base amount (assume stored totalAmount = base - discountAmount)
  const baseAmount = (existing.totalAmount ?? 0) + (existing.discountAmount ?? 0);

  if (parsed.data.action === 'remove') {
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        discountPercent: null,
        discountAmount: null,
        totalAmount: baseAmount,
        loyaltyRateApplied: null,
        loyaltyDiscountAmount: null,
        loyaltyAppliedAt: null
      }
    });
    return res.json(updated);
  }

  // set new rate
  if (parsed.data.action === 'set') {
    if (parsed.data.rate === undefined) return res.status(400).json({ message: 'Missing rate' });
    const rate = parsed.data.rate;
    const discountAmount = Math.round(baseAmount * (rate / 100));
    const totalAmount = Math.max(0, baseAmount - discountAmount);
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        discountPercent: rate,
        discountAmount,
        totalAmount,
        loyaltyRateApplied: rate,
        loyaltyDiscountAmount: discountAmount,
        loyaltyAppliedAt: new Date()
      }
    });
    return res.json(updated);
  }
  res.status(400).json({ message: 'Invalid action' });
}));

// Loyalty program endpoints
adminRouter.get('/loyalty', requireAdmin, asyncHandler(async (_req, res) => {
  const program = await getLoyaltyProgram();
  res.json(program);
}));

adminRouter.patch('/loyalty', requirePermission('bookings:status'), asyncHandler(async (req, res) => {
  // Accept partial updates for program and benefits array
  const schema = z.object({
    isEnabled: z.boolean().optional(),
    minRepeatBookings: z.number().int().min(0).optional(),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    benefits: z.array(z.object({ id: z.string().optional(), nameAr: z.string(), nameEn: z.string(), descriptionAr: z.string().optional(), descriptionEn: z.string().optional(), type: z.string(), value: z.number().int(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() })).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const updates = {};
  if (parsed.data.isEnabled !== undefined) updates.isEnabled = parsed.data.isEnabled;
  if (parsed.data.minRepeatBookings !== undefined) updates.minRepeatBookings = parsed.data.minRepeatBookings;
  if (parsed.data.descriptionAr !== undefined) updates.descriptionAr = parsed.data.descriptionAr;
  if (parsed.data.descriptionEn !== undefined) updates.descriptionEn = parsed.data.descriptionEn;

  let program = await prisma.loyaltyProgram.findFirst({ include: { benefits: true } });
  if (!program) {
    program = await prisma.loyaltyProgram.create({ data: { isEnabled: true }, include: { benefits: true } });
  }

  if (Object.keys(updates).length > 0) {
    program = await prisma.loyaltyProgram.update({ where: { id: program.id }, data: updates, include: { benefits: true } });
  }

  // Upsert benefits if provided
  if (parsed.data.benefits) {
    // For simplicity: remove existing benefits and recreate from provided list
    await prisma.loyaltyBenefit.deleteMany({ where: { programId: program.id } });
    const created = [];
    for (const b of parsed.data.benefits) {
      const c = await prisma.loyaltyBenefit.create({ data: {
        programId: program.id,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        descriptionAr: b.descriptionAr ?? '',
        descriptionEn: b.descriptionEn ?? '',
        type: b.type,
        value: b.value,
        isActive: b.isActive ?? true,
        sortOrder: b.sortOrder ?? 0
      }});
      created.push(c);
    }
    program = await prisma.loyaltyProgram.findUnique({ where: { id: program.id }, include: { benefits: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } });
  }

  // If program updated, recalculate upcoming bookings' loyalty discounts
  // Criteria: bookings with checkIn >= today (start of day) and paymentStatus != 'PAID'
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const candidates = await prisma.booking.findMany({
    where: {
      checkIn: { gte: todayStart },
      paymentStatus: { not: 'PAID' },
      status: { in: ['PENDING', 'CONFIRMED'] }
    }
  });

  const updates = [];
  for (const b of candidates) {
    if (!b.guestPhone) continue;
    const priorConfirmed = await getRepeatCustomerBookings(b.guestPhone, b.id);
    const res = await applyLoyaltyDiscount({ totalAmount: b.totalAmount ?? 0 }, b.guestPhone, priorConfirmed);
    if (res.discountPercent > 0 && res.discountAmount > 0) {
      const baseAmount = (b.totalAmount ?? 0) + (b.discountAmount ?? 0);
      const discountAmount = res.discountAmount;
      const totalAmount = Math.max(0, baseAmount - discountAmount);
      updates.push(prisma.booking.update({ where: { id: b.id }, data: {
        discountPercent: res.discountPercent,
        discountAmount,
        totalAmount,
        loyaltyRateApplied: res.discountPercent,
        loyaltyDiscountAmount: discountAmount,
        loyaltyAppliedAt: new Date()
      }}));
    } else {
      // remove existing loyalty snapshot if any
      if (b.discountPercent || b.loyaltyRateApplied) {
        const baseAmount = (b.totalAmount ?? 0) + (b.discountAmount ?? 0);
        updates.push(prisma.booking.update({ where: { id: b.id }, data: {
          discountPercent: null,
          discountAmount: null,
          totalAmount: baseAmount,
          loyaltyRateApplied: null,
          loyaltyDiscountAmount: null,
          loyaltyAppliedAt: null
        }}));
      }
    }
  }

  if (updates.length) await Promise.all(updates);

  const updatedProgram = await prisma.loyaltyProgram.findUnique({ where: { id: program.id }, include: { benefits: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } });
  res.json({ program: updatedProgram, updatedBookings: updates.length });
}));

adminRouter.get('/booking-requests', requirePermission('requests:manage'), asyncHandler(async (_req, res) => {
  const requests = await prisma.bookingRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      booking: {
        include: {
          unit: { select: { number: true, floor: true } },
          unitType: { select: { nameAr: true, nameEn: true } }
        }
      }
    }
  });
  res.json(requests);
}));

adminRouter.patch('/booking-requests/:id', requirePermission('requests:manage'), asyncHandler(async (req, res) => {
  const schema = z.object({
    status: z.enum(['PENDING', 'AWAITING_CUSTOMER', 'APPROVED', 'REJECTED']).optional(),
    responseMessage: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.string().max(500).nullable().optional()
    )
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || (parsed.data.status === undefined && parsed.data.responseMessage === undefined)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const existing = await prisma.bookingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  const updated = await prisma.bookingRequest.update({
    where: { id: req.params.id },
    data: parsed.data
  });

  if (parsed.data.responseMessage) {
    await prisma.bookingRequestMessage.create({
      data: {
        requestId: updated.id,
        actor: 'ADMIN',
        message: parsed.data.responseMessage
      }
    });
  }
  res.json(updated);
}));

adminRouter.get('/bookings/:id/available-units', requirePermission('bookings:unit'), asyncHandler(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    select: { id: true, unitId: true, unitTypeId: true, checkIn: true, checkOut: true }
  });
  if (!booking) return res.status(404).json({ message: 'Not found' });

  const targetUnitTypeId = req.query.unitTypeId ? String(req.query.unitTypeId) : booking.unitTypeId;
  const units = await prisma.unit.findMany({
    where: { unitTypeId: targetUnitTypeId },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, floor: true, isActive: true }
  });

  const available = [];
  for (const u of units) {
    if (!u.isActive && u.id !== booking.unitId) continue;

    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        unitId: u.id,
        id: { not: booking.id },
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { checkIn: { lt: booking.checkOut } },
          { checkOut: { gt: booking.checkIn } }
        ]
      },
      select: { id: true }
    });
    if (overlappingBooking) continue;

    const overlappingBlock = await prisma.blockedDate.findFirst({
      where: {
        unitId: u.id,
        AND: [
          { startDate: { lt: booking.checkOut } },
          { endDate: { gt: booking.checkIn } }
        ]
      },
      select: { id: true }
    });
    if (overlappingBlock) continue;

    available.push({ id: u.id, number: u.number, floor: u.floor });
  }

  res.json({ currentUnitId: booking.unitId, units: available });
}));

adminRouter.patch('/bookings/:id/unit', requirePermission('bookings:unit'), asyncHandler(async (req, res) => {
  const schema = z.object({ unitId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    select: { id: true, unitTypeId: true, checkIn: true, checkOut: true }
  });
  if (!booking) return res.status(404).json({ message: 'Not found' });

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    select: { id: true, unitTypeId: true, isActive: true }
  });
  if (!unit) return res.status(404).json({ message: 'Unit not found' });
  if (unit.unitTypeId !== booking.unitTypeId) {
    const approvedUpgrade = await prisma.bookingRequest.findFirst({
      where: {
        bookingId: booking.id,
        type: 'UPGRADE',
        status: 'APPROVED'
      },
      select: { id: true }
    });
    if (!approvedUpgrade) {
      return res.status(409).json({ message: 'Upgrade not approved' });
    }
  }
  if (!unit.isActive) {
    return res.status(409).json({ message: 'Unit is inactive' });
  }

  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      unitId: unit.id,
      id: { not: booking.id },
      status: { in: ['PENDING', 'CONFIRMED'] },
      AND: [
        { checkIn: { lt: booking.checkOut } },
        { checkOut: { gt: booking.checkIn } }
      ]
    },
    select: { id: true }
  });
  if (overlappingBooking) {
    return res.status(409).json({ message: 'Unit not available for these dates' });
  }

  const overlappingBlock = await prisma.blockedDate.findFirst({
    where: {
      unitId: unit.id,
      AND: [
        { startDate: { lt: booking.checkOut } },
        { endDate: { gt: booking.checkIn } }
      ]
    },
    select: { id: true }
  });
  if (overlappingBlock) {
    return res.status(409).json({ message: 'Unit blocked for these dates' });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { unitId: unit.id, unitTypeId: unit.unitTypeId },
    include: {
      unit: { select: { id: true, number: true, floor: true, isActive: true } },
      unitType: { select: { code: true, nameAr: true, nameEn: true, bedrooms: true, kitchen: true } }
    }
  });

  res.json(updated);
}));

adminRouter.get('/unit-types', requireAdmin, asyncHandler(async (_req, res) => {
  const types = await prisma.unitType.findMany({
    orderBy: { code: 'asc' },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      seasonalRates: { orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }] },
      minStayRules: { orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }] }
    }
  });
  res.json(types);
}));

adminRouter.patch('/unit-types/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    basePrice: z.number().int().min(0).optional(),
    imageUrl: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().url().nullable().optional()
    ),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    nameAr: z.string().optional(),
    nameEn: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const t = await prisma.unitType.update({
    where: { id: req.params.id },
    data: parsed.data
  });

  res.json(t);
}));

adminRouter.post('/unit-types/:id/images', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const unitTypeId = req.params.id;
  const existing = await prisma.unitImage.count({ where: { unitTypeId } });
  const makePrimary = parsed.data.isPrimary === true || existing === 0;

  if (makePrimary) {
    await prisma.unitImage.updateMany({ where: { unitTypeId }, data: { isPrimary: false } });
  }

  const image = await prisma.unitImage.create({
    data: {
      unitTypeId,
      url: parsed.data.url,
      isPrimary: makePrimary,
      sortOrder: parsed.data.sortOrder ?? 0
    }
  });

  res.status(201).json(image);
}));

adminRouter.post('/unit-types/:id/seasonal-rates', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    startDate: z.string().min(10),
    endDate: z.string().min(10),
    pricePerNight: z.preprocess((v) => Number(v), z.number().int().min(0))
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const start = parseISODateOnly(parsed.data.startDate);
  const end = parseISODateOnly(parsed.data.endDate);
  if (!start || !end || end <= start) return res.status(400).json({ message: 'Invalid dates' });

  const rate = await prisma.seasonalRate.create({
    data: {
      unitTypeId: req.params.id,
      startDate: start,
      endDate: end,
      pricePerNight: parsed.data.pricePerNight
    }
  });

  res.status(201).json(rate);
}));

adminRouter.delete('/seasonal-rates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.seasonalRate.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  await prisma.seasonalRate.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));

adminRouter.post('/unit-types/:id/min-stay', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    startDate: z.string().min(10),
    endDate: z.string().min(10),
    minNights: z.preprocess((v) => Number(v), z.number().int().min(1).max(60))
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const start = parseISODateOnly(parsed.data.startDate);
  const end = parseISODateOnly(parsed.data.endDate);
  if (!start || !end || end <= start) return res.status(400).json({ message: 'Invalid dates' });

  const rule = await prisma.minStayRule.create({
    data: {
      unitTypeId: req.params.id,
      startDate: start,
      endDate: end,
      minNights: parsed.data.minNights
    }
  });

  res.status(201).json(rule);
}));

adminRouter.delete('/min-stay/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.minStayRule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  await prisma.minStayRule.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));

adminRouter.patch('/unit-images/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const existing = await prisma.unitImage.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  if (parsed.data.isPrimary === true) {
    await prisma.unitImage.updateMany({ where: { unitTypeId: existing.unitTypeId }, data: { isPrimary: false } });
  }

  const image = await prisma.unitImage.update({
    where: { id: req.params.id },
    data: parsed.data
  });

  res.json(image);
}));

adminRouter.delete('/unit-images/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.unitImage.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  await prisma.unitImage.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));

adminRouter.get('/units', requireAdmin, asyncHandler(async (_req, res) => {
  const units = await prisma.unit.findMany({
    orderBy: { number: 'asc' },
    include: {
      unitType: { select: { code: true, nameAr: true, nameEn: true } },
      photos: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }
    }
  });
  res.json(units);
}));

adminRouter.post('/units/:id/photos', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  if (parsed.data.isPrimary) {
    await prisma.unitPhoto.updateMany({
      where: { unitId: req.params.id },
      data: { isPrimary: false }
    });
  }

  const photo = await prisma.unitPhoto.create({
    data: {
      unitId: req.params.id,
      url: parsed.data.url,
      isPrimary: parsed.data.isPrimary ?? false,
      sortOrder: parsed.data.sortOrder ?? 0
    }
  });

  res.status(201).json(photo);
}));

adminRouter.patch('/unit-photos/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const existing = await prisma.unitPhoto.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  if (parsed.data.isPrimary) {
    await prisma.unitPhoto.updateMany({
      where: { unitId: existing.unitId },
      data: { isPrimary: false }
    });
  }

  const photo = await prisma.unitPhoto.update({
    where: { id: req.params.id },
    data: parsed.data
  });

  res.json(photo);
}));

adminRouter.delete('/unit-photos/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.unitPhoto.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  await prisma.unitPhoto.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));

adminRouter.patch('/units/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({ isActive: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const unit = await prisma.unit.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(unit);
}));

adminRouter.post('/blocks', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    unitId: z.string().min(1),
    startDate: z.string().min(10),
    endDate: z.string().min(10),
    reason: z.string().max(200).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const [y1,m1,d1] = parsed.data.startDate.split('-').map(Number);
  const [y2,m2,d2] = parsed.data.endDate.split('-').map(Number);
  const start = new Date(Date.UTC(y1, m1-1, d1, 12, 0, 0));
  const end = new Date(Date.UTC(y2, m2-1, d2, 12, 0, 0));
  if (end <= start) return res.status(400).json({ message: 'Invalid dates' });

  const block = await prisma.blockedDate.create({
    data: { unitId: parsed.data.unitId, startDate: start, endDate: end, reason: parsed.data.reason }
  });

  res.status(201).json(block);
}));

adminRouter.get('/blocks', requireAdmin, asyncHandler(async (_req, res) => {
  const blocks = await prisma.blockedDate.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      unit: {
        select: {
          number: true,
          floor: true,
          unitType: { select: { nameAr: true, nameEn: true } }
        }
      }
    }
  });
  res.json(blocks);
}));

adminRouter.delete('/blocks/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.blockedDate.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  await prisma.blockedDate.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));

// Loyalty Program APIs
adminRouter.get('/loyalty-program', requireAdmin, asyncHandler(async (_req, res) => {
  let program = await prisma.loyaltyProgram.findFirst({
    include: {
      benefits: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
    }
  });

  if (!program) {
    program = await prisma.loyaltyProgram.create({
      data: { isEnabled: true },
      include: {
        benefits: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
      }
    });
  }

  res.json(program);
}));

adminRouter.patch('/loyalty-program', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    isEnabled: z.boolean().optional(),
    minRepeatBookings: z.number().int().min(1).optional(),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  let program = await prisma.loyaltyProgram.findFirst();
  if (!program) {
    program = await prisma.loyaltyProgram.create({ data: {} });
  }

  const updated = await prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: parsed.data,
    include: {
      benefits: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
    }
  });

  res.json(updated);
}));

adminRouter.post('/loyalty-benefits', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    nameAr: z.string().min(1),
    nameEn: z.string().min(1),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    type: z.enum(['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'BONUS_POINTS', 'FREE_UPGRADE']),
    value: z.number().int().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  let program = await prisma.loyaltyProgram.findFirst();
  if (!program) {
    program = await prisma.loyaltyProgram.create({ data: {} });
  }

  const maxSortOrder = await prisma.loyaltyBenefit.aggregate({
    where: { programId: program.id },
    _max: { sortOrder: true }
  });
  const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

  const benefit = await prisma.loyaltyBenefit.create({
    data: {
      programId: program.id,
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn,
      descriptionAr: parsed.data.descriptionAr || '',
      descriptionEn: parsed.data.descriptionEn || '',
      type: parsed.data.type,
      value: parsed.data.value,
      isActive: true,
      sortOrder
    }
  });

  res.status(201).json(benefit);
}));

adminRouter.patch('/loyalty-benefits/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    nameAr: z.string().min(1).optional(),
    nameEn: z.string().min(1).optional(),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    type: z.enum(['DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'BONUS_POINTS', 'FREE_UPGRADE']).optional(),
    value: z.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });

  const existing = await prisma.loyaltyBenefit.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Benefit not found' });

  const updated = await prisma.loyaltyBenefit.update({
    where: { id: req.params.id },
    data: parsed.data
  });

  res.json(updated);
}));

adminRouter.delete('/loyalty-benefits/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.loyaltyBenefit.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Benefit not found' });

  await prisma.loyaltyBenefit.delete({ where: { id: req.params.id } });
  res.json({ id: req.params.id });
}));
