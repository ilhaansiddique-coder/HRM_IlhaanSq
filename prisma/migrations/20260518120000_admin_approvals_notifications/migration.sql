-- Admin: approvals inbox + notification center.
-- Fully additive and idempotent: new enums, new nullable/defaulted columns,
-- new tables. No data change, reversible. Employee.approval_status defaults
-- to 'approved' so every EXISTING employee stays active; only newly created
-- employees are forced to 'pending' by the application create flow.

-- ── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ApprovalType" AS ENUM ('employee_onboarding', 'recruitment_joining');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Employee onboarding gate ───────────────────────────────
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'approved';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "approval_decided_by" UUID;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "approval_decided_at" TIMESTAMP(3);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "approval_rejection_reason" TEXT;
CREATE INDEX IF NOT EXISTS "employees_tenant_id_approval_status_idx" ON "employees"("tenant_id", "approval_status");

-- ── Recruitment joining gate ───────────────────────────────
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "joining_status" "ApprovalStatus";
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "joining_decided_by" UUID;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "joining_decided_at" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "joining_rejection_reason" TEXT;

-- ── Approvals inbox ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "type" "ApprovalType" NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "requested_by" UUID,
  "requested_by_name" TEXT,
  "decided_by" UUID,
  "decided_by_name" TEXT,
  "decided_at" TIMESTAMP(3),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "approval_requests_tenant_id_status_idx" ON "approval_requests"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "approval_requests_tenant_id_type_idx" ON "approval_requests"("tenant_id", "type");
DO $$ BEGIN
  ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Notification center ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'activity',
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "link" TEXT,
  "actor_id" UUID,
  "actor_name" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_category_idx" ON "notifications"("tenant_id", "category");
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" UUID NOT NULL,
  "notification_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_reads_notification_id_user_id_key" ON "notification_reads"("notification_id", "user_id");
CREATE INDEX IF NOT EXISTS "notification_reads_user_id_idx" ON "notification_reads"("user_id");
DO $$ BEGIN
  ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
