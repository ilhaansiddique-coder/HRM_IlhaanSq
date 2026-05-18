-- CreateEnum
CREATE TYPE "BreakPenaltyStatus" AS ENUM ('pending', 'applied', 'waived');
CREATE TYPE "BreakStatus" AS ENUM ('active', 'completed');

-- AlterTable - Payslip
ALTER TABLE "payslips" ADD COLUMN "break_penalty" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable - SystemSettings
ALTER TABLE "system_settings" ADD COLUMN "break_time_threshold" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "break_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "break_start" TIMESTAMP(3) NOT NULL,
    "break_end" TIMESTAMP(3),
    "duration_min" INTEGER NOT NULL DEFAULT 0,
    "status" "BreakStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "break_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_penalties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "break_session_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BreakPenaltyStatus" NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMP(3),
    "applied_by" UUID,
    "payslip_id" UUID,
    "exceeded_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "break_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "break_sessions_tenant_id_employee_id_idx" ON "break_sessions"("tenant_id", "employee_id");
CREATE INDEX "break_sessions_tenant_id_break_start_idx" ON "break_sessions"("tenant_id", "break_start");

-- CreateIndex
CREATE INDEX "break_penalties_tenant_id_employee_id_idx" ON "break_penalties"("tenant_id", "employee_id");
CREATE INDEX "break_penalties_tenant_id_status_idx" ON "break_penalties"("tenant_id", "status");
CREATE INDEX "break_penalties_payslip_id_idx" ON "break_penalties"("payslip_id");

-- AddForeignKey
ALTER TABLE "break_sessions" ADD CONSTRAINT "break_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_sessions" ADD CONSTRAINT "break_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_penalties" ADD CONSTRAINT "break_penalties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_penalties" ADD CONSTRAINT "break_penalties_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_penalties" ADD CONSTRAINT "break_penalties_break_session_id_fkey" FOREIGN KEY ("break_session_id") REFERENCES "break_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "break_penalties" ADD CONSTRAINT "break_penalties_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
