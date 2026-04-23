import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

export const rateLimitEnabled = Boolean(redis);

function build(limit: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix: "ratelimit",
  });
}

export const rateLimiters = {
  auth: build(20, "1 m"),
  upload: build(30, "1 m"),
  api: build(120, "1 m"),
} as const;

type LimiterKey = keyof typeof rateLimiters;

export async function checkRate(
  key: LimiterKey,
  identifier: string
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const rl = rateLimiters[key];
  if (!rl) return { allowed: true, retryAfterSec: 0 };
  const { success, reset } = await rl.limit(identifier);
  return {
    allowed: success,
    retryAfterSec: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
