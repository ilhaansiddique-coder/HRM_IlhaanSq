import { prisma } from "../db";

// ─── Export tenant data as JSON ─────────────────────────────
// Workspace + members + settings + HR core (employees, org structure).

export async function exportTenantData(tenantId: string) {
  const [
    tenant,
    members,
    businessSettings,
    systemSettings,
    departments,
    positions,
    employees,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.tenantMember.findMany({ where: { tenantId } }),
    prisma.businessSettings.findUnique({ where: { tenantId } }),
    prisma.systemSettings.findUnique({ where: { tenantId } }),
    prisma.department.findMany({ where: { tenantId } }),
    prisma.position.findMany({ where: { tenantId } }),
    prisma.employee.findMany({ where: { tenantId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    members,
    businessSettings,
    systemSettings,
    departments,
    positions,
    employees,
  };
}

// ─── Counts for system health panel ─────────────────────────

export async function getSystemStats(tenantId: string) {
  const [employeeCount, departmentCount, payrollRunCount, activityLogCount] =
    await Promise.all([
      prisma.employee.count({ where: { tenantId } }),
      prisma.department.count({ where: { tenantId } }),
      prisma.payrollRun.count({ where: { tenantId } }),
      prisma.activityLog.count({ where: { tenantId } }),
    ]);

  return { employeeCount, departmentCount, payrollRunCount, activityLogCount };
}
