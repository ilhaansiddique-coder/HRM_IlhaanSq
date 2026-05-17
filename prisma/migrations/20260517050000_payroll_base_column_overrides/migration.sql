-- CreateTable
CREATE TABLE "payroll_base_column_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "name_override" TEXT,
    "short_label_override" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "group_override" "PayrollColumnGroup",
    "formula" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_base_column_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_recompute_backups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "slip_count" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "restored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_recompute_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_base_column_overrides_tenant_id_idx" ON "payroll_base_column_overrides"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_base_column_overrides_tenant_id_field_key_key" ON "payroll_base_column_overrides"("tenant_id", "field_key");

-- CreateIndex
CREATE INDEX "payroll_recompute_backups_tenant_id_idx" ON "payroll_recompute_backups"("tenant_id");

-- AddForeignKey
ALTER TABLE "payroll_base_column_overrides" ADD CONSTRAINT "payroll_base_column_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_recompute_backups" ADD CONSTRAINT "payroll_recompute_backups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

