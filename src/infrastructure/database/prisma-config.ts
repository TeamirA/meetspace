import { SUPABASE_ROOT_CA } from "./supabaseCa";

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
