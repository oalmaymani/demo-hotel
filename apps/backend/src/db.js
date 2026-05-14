import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://towseasons:towseasons@localhost:5432/towseasons?schema=public';
}

export const prisma = new PrismaClient();
