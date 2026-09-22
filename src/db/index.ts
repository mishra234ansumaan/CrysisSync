import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);
const globalForDb = globalThis as typeof globalThis & {
  __crisisSyncPostgresPool?: Pool;
};

/**
 * Supabase's pooled connection string is recommended on Vercel. Keep the pool
 * deliberately small because each serverless instance can create its own pool.
 */
export const pool =
  globalForDb.__crisisSyncPostgresPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocal || process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_SIZE ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__crisisSyncPostgresPool = pool;
}

export const db = drizzle(pool);
