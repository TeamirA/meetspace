import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "../env";
import { SUPABASE_ROOT_CA } from "./supabaseCa";

export type Db = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { __prisma?: Db };

/**
 * node-postgres treats `sslmode=require` as full verification against the system trust store,
 * which doesn't include Supabase's private CA. We strip sslmode and verify against the pinned root.
 */
export function poolConfig(connectionString: string) {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("pgbouncer");
  return {
    connectionString: url.toString(),
    max: 5,
    ...(!local && { ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } }),
  };
}

export function createPrismaClient(connectionString: string, schema?: string): Db {
  const adapter = new PrismaPg(poolConfig(connectionString), schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

/** One client per serverless instance (and per dev-server HMR cycle). */
export function prisma(): Db {
  globalForPrisma.__prisma ??= createPrismaClient(env().DATABASE_URL);
  return globalForPrisma.__prisma;
}
