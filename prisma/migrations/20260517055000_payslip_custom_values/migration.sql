-- AlterTable
ALTER TABLE "payroll_custom_columns" ADD COLUMN     "manual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "payslip_custom_values" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "value" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslip_custom_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payslip_custom_values_column_id_idx" ON "payslip_custom_values"("column_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_custom_values_payslip_id_column_id_key" ON "payslip_custom_values"("payslip_id", "column_id");

-- AddForeignKey
ALTER TABLE "payslip_custom_values" ADD CONSTRAINT "payslip_custom_values_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_custom_values" ADD CONSTRAINT "payslip_custom_values_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "payroll_custom_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

