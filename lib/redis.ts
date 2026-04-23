import Redis from "ioredis";

// ─── Redis Client Singleton ─────────────────────────────────
//
// Redis is OPTIONAL. The client is only created when REDIS_HOST is explicitly
// set in the environment. When unset, all cache operations short-circuit to
// no-ops — the caller's fallback (usually a direct DB query) runs immediately.
//
// This prevents the common dev footgun of ioredis silently retrying against
// 127.0.0.1:6379, burning 1–2 seconds per request before timing out.

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_ENABLED = Boolean(REDIS_HOST);

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedisClient(): Redis {
  const client = new Redis({
    host: REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      if (times > 3) return null; // give up quickly
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Redis] Connected");
    }
  });

  return client;
}

export const redis: Redis | null = REDIS_ENABLED
  ? (globalForRedis.redis ?? createRedisClient())
  : null;

if (REDIS_ENABLED && redis && process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

if (!REDIS_ENABLED && process.env.NODE_ENV === "development") {
  console.log("[Redis] Disabled (REDIS_HOST not set) — cache ops are no-ops.");
}

// ─── Cache Helpers ──────────────────────────────────────────

export type CacheOptions = {
  /** Time-to-live in seconds */
  ttl: number;
};

/**
 * Get a value from Redis, parsing JSON automatically.
 * Returns null on miss, parse failure, or when Redis is disabled.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis with JSON serialization and TTL.
 * No-op when Redis is disabled.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  opts: CacheOptions
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", opts.ttl);
  } catch {
    // Cache write failure is non-fatal — log and continue
  }
}

/**
 * Delete one or more cache keys. No-op when Redis is disabled.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis) return;
  try {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Cache delete failure is non-fatal
  }
}

/**
 * Delete all keys matching a pattern (e.g., "tenant:abc:products*").
 * Uses SCAN to avoid blocking Redis. No-op when Redis is disabled.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Pattern invalidation failure is non-fatal
  }
}

// ─── Tenant Cache Key Builders ──────────────────────────────

export const CacheKeys = {
  // Products
  products: (tenantId: string) => `t:${tenantId}:products`,
  product: (tenantId: string, id: string) => `t:${tenantId}:product:${id}`,

  // Customers
  customers: (tenantId: string) => `t:${tenantId}:customers`,
  customer: (tenantId: string, id: string) => `t:${tenantId}:customer:${id}`,

  // Sales
  sales: (tenantId: string) => `t:${tenantId}:sales`,
  sale: (tenantId: string, id: string) => `t:${tenantId}:sale:${id}`,

  // Dashboard
  dashboard: (tenantId: string) => `t:${tenantId}:dashboard`,

  // Settings
  businessSettings: (tenantId: string) => `t:${tenantId}:biz-settings`,
  systemSettings: (tenantId: string) => `t:${tenantId}:sys-settings`,

  // Payment methods
  paymentMethods: (tenantId: string) => `t:${tenantId}:payment-methods`,

  // All keys for a tenant (for bulk invalidation)
  tenantPattern: (tenantId: string) => `t:${tenantId}:*`,
} as const;

// ─── TTL Constants (seconds) ────────────────────────────────

export const CacheTTL = {
  /** Dashboard metrics — needs to be relatively fresh */
  DASHBOARD: 60,
  /** Product/customer lists — moderate change frequency */
  LIST: 300,
  /** Single entity detail — can be slightly stale */
  ENTITY: 600,
  /** Settings — rarely changes */
  SETTINGS: 1800,
} as const;
