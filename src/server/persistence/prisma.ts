import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. Cached on globalThis so Next.js hot reload and
 * the realtime server share one connection pool per process.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

/** True when a database is configured; the game runs fully without one. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
