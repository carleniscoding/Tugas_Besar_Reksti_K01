import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  Prisma,
  PrismaClient,
  Role,
  type Penduduk,
  type User,
} from "../../generated/prisma/default.js";

export { Prisma, Role };
export type { Penduduk, User };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
