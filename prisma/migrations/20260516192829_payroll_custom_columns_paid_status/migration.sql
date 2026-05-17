-- CreateEnum
CREATE TYPE "PayrollColumnGroup" AS ENUM ('earning', 'deduction');

-- CreateEnum
CREATE TYPE "PayrollColumnOp" AS ENUM ('multiply', 'add', 'subtract');

-- CreateEnum
CREATE TYPE "PayrollColumnOperand" AS ENUM ('field', 'constant');

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "paid_by" UUID;

-- CreateTable
CREATE TABLE "payroll_custom_columns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_label" TEXT NOT NULL,
    "group" "PayrollColumnGroup" NOT NULL,
    "operation" "PayrollColumnOp" NOT NULL,
    "source_field" TEXT NOT NULL,
    "operand_kind" "PayrollColumnOperand" NOT NULL DEFAULT 'field',
    "operand_field" TEXT,
    "operand_value" DECIMAL(14,4),
    "affects_total" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_custom_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_custom_columns_tenant_id_idx" ON "payroll_custom_columns"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_custom_columns_tenant_id_name_key" ON "payroll_custom_columns"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "payroll_custom_columns" ADD CONSTRAINT "payroll_custom_columns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

