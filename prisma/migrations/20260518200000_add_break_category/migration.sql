-- Break reason category + duty classification. Additive & idempotent.
-- "courier" (work errand) counts as working/duty time; anything else
-- (default 'personal') is an out-of-duty break.
ALTER TABLE "break_sessions" ADD COLUMN IF NOT EXISTS "break_category" TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE "break_sessions" ADD COLUMN IF NOT EXISTS "is_duty" BOOLEAN NOT NULL DEFAULT false;
