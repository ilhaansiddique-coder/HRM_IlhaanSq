import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from "./redis";
import { tenantDb } from "./db";
import type { Prisma } from "@prisma/client";

// ─── Cached Data Fetchers ───────────────────────────────────
// Each function: check Redis → hit? return → miss? query Prisma → cache → return.
// Server Components call these directly. Zero loading spinners.

// ─── Settings ───────────────────────────────────────────────

export async function getCachedBusinessSettings(tenantId: string) {
  const key = CacheKeys.businessSettings(tenantId);
  const cached = await cacheGet<Prisma.BusinessSettingsGetPayload<object>>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const settings = await db.businessSettings.findUnique({
    where: { tenantId },
  });

  if (settings) {
    await cacheSet(key, settings, { ttl: CacheTTL.SETTINGS });
  }
  return settings;
}

export async function getCachedSystemSettings(tenantId: string) {
  const key = CacheKeys.systemSettings(tenantId);
  const cached = await cacheGet<Prisma.SystemSettingsGetPayload<object>>(key);
  if (cached) return cached;

  const db = tenantDb(tenantId);
  const settings = await db.systemSettings.findUnique({
    where: { tenantId },
  });

  if (settings) {
    await cacheSet(key, settings, { ttl: CacheTTL.SETTINGS });
  }
  return settings;
}

export async function invalidateSettingsCache(tenantId: string) {
  await cacheDel(
    CacheKeys.businessSettings(tenantId),
    CacheKeys.systemSettings(tenantId)
  );
}
