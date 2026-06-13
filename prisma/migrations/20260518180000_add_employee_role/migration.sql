-- Employee self-service portal role. Additive & idempotent.
ALTER TYPE "TenantRole" ADD VALUE IF NOT EXISTS 'employee';
