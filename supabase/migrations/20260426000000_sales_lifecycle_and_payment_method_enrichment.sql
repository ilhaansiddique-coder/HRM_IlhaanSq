-- ════════════════════════════════════════════════════════════════
-- Sales lifecycle (return / lost) + PaymentMethod enrichment
-- ════════════════════════════════════════════════════════════════
-- Two related additions:
--
-- 1. Sale gets symmetric lifecycle timestamps for the cancel-style
--    flows we don't yet expose (returned_at, lost_at, status_changed_at).
--    inventory_restored already exists and is the once-only guard;
--    these new columns just record when the transition happened.
--
-- 2. PaymentMethod gains the metadata the form needs to drive default
--    payment terms and amount-paid prefill behavior per method
--    (matches the reference spec). All new columns are NOT NULL with
--    safe defaults (or NULL-able), so existing rows keep working.
--    `key` is backfilled from a slug of `name` and then a (tenant, key)
--    unique index is added.

BEGIN;

-- ─── Sale lifecycle columns ─────────────────────────────────
ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "returned_at"        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "lost_at"            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "status_changed_at"  timestamptz NULL;

-- ─── PaymentMethod enrichment ───────────────────────────────
ALTER TABLE "payment_methods"
  ADD COLUMN IF NOT EXISTS "key"                   text     NULL,
  ADD COLUMN IF NOT EXISTS "type"                  text     NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS "default_terms"         text     NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS "default_paid_behavior" text     NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS "fee_type"              text     NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "fee_value"             numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS "sort_order"            integer  NOT NULL DEFAULT 0;

-- Backfill `key` for existing rows: lower-snake-case of `name`,
-- collisions resolved by appending the row's id suffix. Only touch
-- rows where key is NULL to keep this re-runnable.
UPDATE "payment_methods" pm
SET "key" = sub.candidate
FROM (
  SELECT
    id,
    -- "Bkash Personal" → "bkash_personal"; "  Cash  " → "cash"
    regexp_replace(
      regexp_replace(lower(trim(name)), '[^a-z0-9]+', '_', 'g'),
      '(^_+|_+$)', '', 'g'
    ) AS candidate
  FROM "payment_methods"
  WHERE "key" IS NULL
) sub
WHERE pm.id = sub.id;

-- Resolve any duplicates within the same tenant by appending the
-- last 8 chars of the id — harmless tail for the rare collision.
UPDATE "payment_methods" pm
SET "key" = pm."key" || '_' || right(pm.id::text, 8)
WHERE pm.id IN (
  SELECT id FROM (
    SELECT
      id,
      row_number() OVER (PARTITION BY tenant_id, "key" ORDER BY created_at) AS rn
    FROM "payment_methods"
    WHERE "key" IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Best-effort defaults derived from `name` for the type/terms/behavior
-- fields. Anything we don't recognize stays at the column default
-- ('cash' / 'immediate' / 'full'), which is harmless.
UPDATE "payment_methods"
SET
  "type" = CASE
    WHEN "key" = 'cash'   THEN 'cash'
    WHEN "key" = 'cod'    THEN 'cod'
    WHEN "key" = 'credit' THEN 'credit'
    WHEN "key" IN ('bkash','nagad','rocket','upay') THEN 'mobile'
    WHEN "key" IN ('bank','bank_transfer','card','visa','mastercard') THEN 'bank'
    ELSE "type"
  END,
  "default_terms" = CASE
    WHEN "key" = 'cod'    THEN 'cod'
    WHEN "key" = 'credit' THEN 'credit'
    ELSE "default_terms"
  END,
  "default_paid_behavior" = CASE
    WHEN "key" IN ('cod','credit') THEN 'zero'
    ELSE "default_paid_behavior"
  END,
  "sort_order" = CASE
    WHEN "key" = 'cash'   THEN 1
    WHEN "key" = 'bkash'  THEN 2
    WHEN "key" = 'nagad'  THEN 3
    WHEN "key" = 'cod'    THEN 90
    WHEN "key" = 'credit' THEN 99
    ELSE "sort_order"
  END
WHERE "key" IS NOT NULL;

-- (tenant_id, key) unique constraint, matching the Prisma model.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_tenant_id_key_key"
  ON "payment_methods" ("tenant_id", "key");

CREATE INDEX IF NOT EXISTS "payment_methods_tenant_id_sort_order_idx"
  ON "payment_methods" ("tenant_id", "sort_order");

COMMIT;
