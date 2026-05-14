import { prisma } from '../db.js';

function buildUnitWhere({ unitTypeId, floors }) {
  const where = { unitTypeId, isActive: true };
  if (Array.isArray(floors) && floors.length > 0) {
    where.floor = { in: floors };
  }
  return where;
}

export async function findAvailableUnitForType({ unitTypeId, checkIn, checkOut, floors }) {
  // Strategy: pick first active unit (optionally filtered by floor) with no overlapping booking and no overlapping blocks.
  const units = await prisma.unit.findMany({
    where: buildUnitWhere({ unitTypeId, floors }),
    orderBy: { number: 'asc' },
    select: { id: true }
  });

  for (const u of units) {
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        unitId: u.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } }
        ]
      },
      select: { id: true }
    });

    if (overlappingBooking) continue;

    const overlappingBlock = await prisma.blockedDate.findFirst({
      where: {
        unitId: u.id,
        AND: [
          { startDate: { lt: checkOut } },
          { endDate: { gt: checkIn } }
        ]
      },
      select: { id: true }
    });

    if (overlappingBlock) continue;

    return u.id;
  }

  return null;
}

export async function countAvailableUnitsForType({ unitTypeId, checkIn, checkOut, floors }) {
  const units = await prisma.unit.findMany({
    where: buildUnitWhere({ unitTypeId, floors }),
    select: { id: true }
  });

  let count = 0;
  for (const u of units) {
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        unitId: u.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } }
        ]
      },
      select: { id: true }
    });
    if (overlappingBooking) continue;

    const overlappingBlock = await prisma.blockedDate.findFirst({
      where: {
        unitId: u.id,
        AND: [
          { startDate: { lt: checkOut } },
          { endDate: { gt: checkIn } }
        ]
      },
      select: { id: true }
    });
    if (overlappingBlock) continue;

    count += 1;
  }
  return count;
}
