import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@towseasons.local';
  const pass = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const exists = await prisma.adminUser.findUnique({ where: { email } });
  const permissions = [
    'bookings:view',
    'bookings:status',
    'bookings:unit',
    'requests:manage',
    'users:manage'
  ];
  if (!exists) {
    const hashed = await bcrypt.hash(pass, 10);
    await prisma.adminUser.create({
      data: {
        email,
        password: hashed,
        permissions,
        isSuperAdmin: true,
        isActive: true
      }
    });
  } else {
    await prisma.adminUser.update({
      where: { email },
      data: {
        permissions,
        isSuperAdmin: true,
        isActive: true
      }
    });
  }
}

const NEW_TYPES = [
  {
    code: '4BR-L',
    nameAr: 'شقة 4 غرف (مطبخ كبير)',
    nameEn: '4BR Apartment (Large Kitchen)',
    bedrooms: 4,
    hasMajlis: true,
    kitchen: 'LARGE',
    descriptionAr: 'شقة واسعة: 4 غرف نوم + مجلس + مطبخ كبير.',
    descriptionEn: 'Spacious unit: 4 bedrooms + majlis + large kitchen.',
    basePrice: 800,
    imageUrl: ''
  },
  {
    code: '3BR-L',
    nameAr: 'شقة 3 غرف (مطبخ كبير)',
    nameEn: '3BR Apartment (Large Kitchen)',
    bedrooms: 3,
    hasMajlis: true,
    kitchen: 'LARGE',
    descriptionAr: 'شقة: 3 غرف نوم + مجلس + مطبخ كبير.',
    descriptionEn: 'Unit: 3 bedrooms + majlis + large kitchen.',
    basePrice: 700,
    imageUrl: ''
  },
  {
    code: '2BR-L',
    nameAr: 'شقة غرفتين (مطبخ كبير)',
    nameEn: '2BR Apartment (Large Kitchen)',
    bedrooms: 2,
    hasMajlis: true,
    kitchen: 'LARGE',
    descriptionAr: 'شقة: غرفتين نوم + مجلس + مطبخ كبير.',
    descriptionEn: 'Unit: 2 bedrooms + majlis + large kitchen.',
    basePrice: 600,
    imageUrl: ''
  },
  {
    code: '2BR-S',
    nameAr: 'شقة غرفتين (مطبخ صغير)',
    nameEn: '2BR Apartment (Small Kitchen)',
    bedrooms: 2,
    hasMajlis: true,
    kitchen: 'SMALL',
    descriptionAr: 'شقة: غرفتين نوم + مجلس + مطبخ صغير.',
    descriptionEn: 'Unit: 2 bedrooms + majlis + small kitchen.',
    basePrice: 560,
    imageUrl: ''
  },
  {
    code: '1BR-S',
    nameAr: 'شقة غرفة (مطبخ صغير)',
    nameEn: '1BR Apartment (Small Kitchen)',
    bedrooms: 1,
    hasMajlis: true,
    kitchen: 'SMALL',
    descriptionAr: 'شقة: غرفة نوم + مجلس + مطبخ صغير.',
    descriptionEn: 'Unit: 1 bedroom + majlis + small kitchen.',
    basePrice: 420,
    imageUrl: ''
  },
  {
    code: 'ROOM',
    nameAr: 'غرفة مستقلة',
    nameEn: 'Standalone Room',
    bedrooms: 0,
    hasMajlis: false,
    kitchen: 'NONE',
    descriptionAr: 'غرفة مستقلة مع دورة مياه (بدون مطبخ).',
    descriptionEn: 'Standalone room with bathroom (no kitchen).',
    basePrice: 250,
    imageUrl: ''
  }
];

const LEGACY_TYPE_MAP = {
  'F1-A': '4BR-L',
  'F1-B': '2BR-S',
  'F1-C': '2BR-L',
  'T-2BR-L': '2BR-L',
  'T-2BR-S': '2BR-S',
  'T-ROOM': 'ROOM',
  'T-1BR-S': '1BR-S',
  'T-3BR-L': '3BR-L',
  'P-2BR-L': '2BR-L',
  'P-3BR-L': '3BR-L'
};

async function upsertUnitTypes() {
  for (const t of NEW_TYPES) {
    await prisma.unitType.upsert({
      where: { code: t.code },
      create: t,
      update: {
        nameAr: t.nameAr,
        nameEn: t.nameEn,
        bedrooms: t.bedrooms,
        hasMajlis: t.hasMajlis,
        kitchen: t.kitchen,
        descriptionAr: t.descriptionAr,
        descriptionEn: t.descriptionEn,
        basePrice: t.basePrice
      }
    });
  }
}

async function migrateLegacyImages() {
  const legacyCodes = Object.keys(LEGACY_TYPE_MAP);
  const legacyTypes = await prisma.unitType.findMany({
    where: { code: { in: legacyCodes } },
    include: { images: true }
  });
  if (!legacyTypes.length) return;

  const newTypes = await prisma.unitType.findMany({
    where: { code: { in: Object.values(LEGACY_TYPE_MAP) } },
    select: { id: true, code: true }
  });
  const newTypeByCode = new Map(newTypes.map((t) => [t.code, t.id]));

  for (const legacy of legacyTypes) {
    const targetCode = LEGACY_TYPE_MAP[legacy.code];
    const targetId = targetCode ? newTypeByCode.get(targetCode) : null;
    if (!targetId) continue;

    for (const img of legacy.images) {
      const exists = await prisma.unitImage.findFirst({
        where: { unitTypeId: targetId, url: img.url }
      });
      if (exists) continue;

      let isPrimary = img.isPrimary;
      if (isPrimary) {
        const hasPrimary = await prisma.unitImage.findFirst({
          where: { unitTypeId: targetId, isPrimary: true },
          select: { id: true }
        });
        if (hasPrimary) isPrimary = false;
      }

      await prisma.unitImage.create({
        data: {
          unitTypeId: targetId,
          url: img.url,
          isPrimary,
          sortOrder: img.sortOrder ?? 0
        }
      });
    }
  }
}

async function ensureUnits() {
  const typeByCode = async (code) => (await prisma.unitType.findUnique({ where: { code } })).id;

  const units = [
    { number: 101, floor: 1, code: '4BR-L' },
    { number: 102, floor: 1, code: '2BR-S' },
    { number: 103, floor: 1, code: '2BR-L' }
  ];

  for (let floor = 2; floor <= 6; floor++) {
    const base = floor * 100;
    units.push(
      { number: base + 1, floor, code: '2BR-L' },  // 201
      { number: base + 2, floor, code: '2BR-S' },  // 202
      { number: base + 3, floor, code: 'ROOM' },   // 203
      { number: base + 4, floor, code: '1BR-S' },  // 204
      { number: base + 5, floor, code: '3BR-L' }   // 205
    );
  }

  units.push(
    { number: 701, floor: 7, code: '2BR-L' },
    { number: 702, floor: 7, code: '3BR-L' }
  );

  for (const u of units) {
    const unitTypeId = await typeByCode(u.code);
    await prisma.unit.upsert({
      where: { number: u.number },
      create: { number: u.number, floor: u.floor, unitTypeId },
      update: { floor: u.floor, unitTypeId }
    });
  }
}

async function syncBookingsUnitTypes() {
  const bookings = await prisma.booking.findMany({
    include: { unit: { select: { unitTypeId: true } } }
  });
  for (const b of bookings) {
    if (!b.unit) continue;
    if (b.unitTypeId !== b.unit.unitTypeId) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { unitTypeId: b.unit.unitTypeId }
      });
    }
  }
}

async function cleanupLegacyUnitTypes() {
  const newCodes = NEW_TYPES.map((t) => t.code);
  await prisma.unitType.deleteMany({
    where: {
      code: { notIn: newCodes },
      units: { none: {} },
      bookings: { none: {} },
      images: { none: {} }
    }
  });
}

async function main() {
  await ensureAdmin();
  await upsertUnitTypes();
  await migrateLegacyImages();
  await ensureUnits();
  await syncBookingsUnitTypes();
  await cleanupLegacyUnitTypes();
  console.log('Seed completed');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
