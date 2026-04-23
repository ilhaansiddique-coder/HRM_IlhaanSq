import { prisma } from "../../db";

type TenantScopedModel =
  | "employee"
  | "department"
  | "position"
  | "leaveType"
  | "leaveRequest"
  | "leaveBalance"
  | "reviewCycle"
  | "goal"
  | "review"
  | "jobPosting"
  | "candidate"
  | "application"
  | "course"
  | "enrollment"
  | "documentCategory"
  | "employeeDocument"
  | "salaryStructure"
  | "salaryComponent"
  | "payrollPeriod"
  | "payrollRun"
  | "attendanceRecord";

/**
 * Throws if any id in `ids` does not belong to `tenantId` for the given model.
 * Use before any write that accepts an id from the client.
 */
export async function assertTenantOwns(
  tenantId: string,
  model: TenantScopedModel,
  ids: (string | undefined | null)[]
) {
  const unique = Array.from(
    new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))
  );
  if (unique.length === 0) return;

  const delegate = (prisma as any)[model];
  if (!delegate) throw new Error(`Unknown model: ${model}`);

  const rows = await delegate.findMany({
    where: { id: { in: unique }, tenantId },
    select: { id: true },
  });

  if (rows.length !== unique.length) {
    throw new Error(`One or more referenced records do not belong to this workspace`);
  }
}

/**
 * Variant for cases where the record doesn't itself carry tenantId but lives
 * under a parent that does. Example: attendance record references employeeId,
 * employee has tenantId.
 */
export async function assertEmployeeOwnership(
  tenantId: string,
  employeeIds: (string | undefined | null)[]
) {
  await assertTenantOwns(tenantId, "employee", employeeIds);
}
