-- Generalize the approval framework so new approval kinds need NO migration.
-- Additive & idempotent. Existing rows (employee_onboarding /
-- recruitment_joining) cast cleanly to text.

-- Allow advances to sit in a pending (awaiting-approval) state.
ALTER TYPE "AdvanceStatus" ADD VALUE IF NOT EXISTS 'pending';

-- approval_requests.type: enum -> free-form text.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests'
      AND column_name = 'type'
      AND udt_name = 'ApprovalType'
  ) THEN
    ALTER TABLE "approval_requests" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
  END IF;
END $$;

-- Deferred-action payload (for approvals that have no entity row yet:
-- salary assignment, customer payment, payroll config / run, payslip paid).
ALTER TABLE "approval_requests" ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- entity_id is optional for deferred-action approvals.
ALTER TABLE "approval_requests" ALTER COLUMN "entity_id" DROP NOT NULL;
