import { prisma } from '../db.js';

export async function getLoyaltyProgram() {
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

  return program;
}

export async function applyLoyaltyDiscount(booking, guestPhone, priorConfirmedCount = 0) {
  const program = await getLoyaltyProgram();

  if (!program.isEnabled || priorConfirmedCount < program.minRepeatBookings) {
    return { discountPercent: 0, discountAmount: 0 };
  }

  // Find the best discount benefit (DISCOUNT_PERCENT takes priority)
  const discountBenefit = program.benefits.find(b => b.type === 'DISCOUNT_PERCENT') ||
                          program.benefits.find(b => b.type === 'DISCOUNT_FIXED');

  if (!discountBenefit || !booking.totalAmount) {
    return { discountPercent: 0, discountAmount: 0 };
  }

  let discountAmount = 0;
  let discountPercent = 0;

  if (discountBenefit.type === 'DISCOUNT_PERCENT') {
    discountPercent = discountBenefit.value;
    discountAmount = Math.round(booking.totalAmount * (discountBenefit.value / 100));
  } else if (discountBenefit.type === 'DISCOUNT_FIXED') {
    discountAmount = Math.min(discountBenefit.value, booking.totalAmount);
    discountPercent = Math.round((discountAmount / booking.totalAmount) * 100);
  }

  return { discountPercent, discountAmount };
}

export async function getRepeatCustomerBookings(guestPhone, beforeBookingId) {
  const count = await prisma.booking.count({
    where: {
      guestPhone,
      status: 'CONFIRMED',
      id: { not: beforeBookingId },
      createdAt: { lt: new Date() } // Only count confirmed bookings made before now
    }
  });
  return count;
}
