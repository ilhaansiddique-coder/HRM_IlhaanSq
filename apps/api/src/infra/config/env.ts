import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PLATFORM_DATABASE_URL: z.string().optional().default(""),
  PLATFORM_DATABASE_POOLER_URL: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),
  SUPABASE_DB_URL: z.string().optional().default(""),
  PLATFORM_DATABASE_SSL_MODE: z.string().optional().default(""),
  PLATFORM_DATABASE_ENABLE_POOLER_FALLBACK: z
    .enum(["0", "1", "true", "false", ""])
    .optional()
    .default("1"),
  PLATFORM_DATABASE_ALLOW_SELF_SIGNED_DEV: z
    .enum(["0", "1", "true", "false", ""])
    .optional()
    .default(""),
  TENANT_DB_SECRET_PROVIDER: z.string().optional().default(""),
  TENANT_DB_DECRYPT_URL: z.string().optional().default(""),
  TENANT_DB_DECRYPT_AUTH_TOKEN: z.string().optional().default(""),
  TENANT_DB_DECRYPT_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(5000),
  REDIS_HOST: z.string().optional().default(""),
  REDIS_PORT: z.string().optional().default(""),
  REDIS_PASSWORD: z.string().optional().default(""),
  TEMPORAL_ADDRESS: z.string().optional().default(""),
  TEMPORAL_NAMESPACE: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  KMS_KEY_ID: z.string().optional().default(""),
});

export type AppEnv = z.infer<typeof envSchema>;
