-- Optional advance recovery window (date-range picker on advance creation).
-- Additive, nullable: no data change, fully reversible (DROP COLUMN).
ALTER TABLE "employee_advances" ADD COLUMN IF NOT EXISTS "recovery_start" date;
ALTER TABLE "employee_advances" ADD COLUMN IF NOT EXISTS "recovery_end" date;
