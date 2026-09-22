/**
 * Database-backed fixed-window rate limiter for public no-login routes.
 * IP addresses are SHA-256 hashed before storage; raw visitor IPs are not kept.
 */
import { createHash } from "crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "crisissync-local-rate-limit";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `${scope}:${clientFingerprint(request)}`;
  const now = new Date();
  const result = await db.execute(sql`
    INSERT INTO api_rate_limits (key, count, window_start, updated_at)
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN api_rate_limits.window_start < ${now}::timestamptz - (${windowMs} * interval '1 millisecond')
          THEN 1
        ELSE api_rate_limits.count + 1
      END,
      window_start = CASE
        WHEN api_rate_limits.window_start < ${now}::timestamptz - (${windowMs} * interval '1 millisecond')
          THEN ${now}
        ELSE api_rate_limits.window_start
      END,
      updated_at = ${now}
    RETURNING count, window_start
  `);
  const row = result.rows[0] as { count: number | string; window_start: Date | string };
  const count = Number(row.count);
  const windowStart = new Date(row.window_start).getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000));
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds,
  };
}
