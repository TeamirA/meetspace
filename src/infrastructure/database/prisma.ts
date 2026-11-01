import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "../env";
import { poolConfig } from "./prisma-config";

export type Db = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { __prisma?: Db };

export function createPrismaClient(connectionString: string, schema?: string): Db {
  const adapter = new PrismaPg(poolConfig(connectionString), schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

/** One client per serverless instance (and per dev-server HMR cycle). */
export function prisma(): Db {
  globalForPrisma.__prisma ??= createPrismaClient(env().DATABASE_URL);
  return globalForPrisma.__prisma;
}
