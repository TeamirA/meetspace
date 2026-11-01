import { config } from "dotenv";
import pg from "pg";
import { poolConfig } from "../../src/infrastructure/database/prisma-config";

/**
 * Local e2e runs register many throwaway accounts from 127.0.0.1, which trips the signup and
 * login rate limits. Clear only the buckets for local addresses; never runs against remote URLs.
 */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  const base = process.env.E2E_BASE_URL ?? "http://localhost";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(base) || !process.env.DATABASE_URL) return;
  const client = new pg.Client(poolConfig(process.env.DATABASE_URL));
  await client.connect();
  await client.query(
    `DELETE FROM rate_limit_buckets WHERE key ~ '^(register|login|join):ip:(local|::1|127\\.0\\.0\\.1|::ffff:127\\.0\\.0\\.1)$'`,
  );
  await client.end();
}
