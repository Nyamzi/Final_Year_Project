import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function initializeDatabase(): Promise<void> {
  await prisma.$connect();
  console.log("✅ Database connected successfully (PostgreSQL + Prisma)");
}

