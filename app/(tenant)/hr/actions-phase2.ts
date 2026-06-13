"use server";

import { requireTenant } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createApprovalRequest } from "@/lib/services/approvals.service";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { checkRate } from "@/lib/rate-limit";
import { publishAdvanceChange, type AdvanceChangeKind } from "@/lib/realtime/bus";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const HR_DOC_MAX_BYTES = 15 * 1024 * 1024;
const HR_DOC_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Reconcile the tenant's runs (all non-failed; unpaid payslips only — paid
// ones stay frozen), revalidate the run + advances pages, then push ONE
// tenant-scoped websocket event so every open salary sheet AND the advances
// page live-refresh and show a popup. Always publishes (even with no runs) so
// the advances page still gets notified.
async function syncAdvances(tenantId: string, kind: AdvanceChangeKind) {
  const runIds = await reconcileRunAdvancesForTenant(tenantId);
  for (const runId of runIds) revalidatePath(`/hr/payroll/runs/${runId}`);
  if (runIds.length) revalidatePath("/hr/payroll/runs");
  revalidatePath("/hr/payroll/advances");
  publishAdvanceChange({ tenantId, kind });
}

// ─── PAYROLL ────────────────────────────────────────────────

import {
  createSalaryStructure,
  updateSalaryStructure,
  ensureStandardSalaryStructure,
  seedStandardAllowanceRows,
  addSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent,
  runPayroll,
  updatePayslip,
  isTenantAdmin,
  assignSalary,
  createAdvance,
  cancelAdvance,
  updateAdvance,
  reconcileRunAdvancesForTenant,
  refreshRunAdvances,
  setEmployeeAdvanceInstallmentFromSheet,
  getStoredAdvanceRecovered,
  createPayrollColumn,
  updatePayrollColumn,
  deletePayrollColumn,
  setPayslipPaid,
  setPayslipCustomValue,
  setBaseColumnOverride,
  clearBaseColumnOverride,
  recomputeTenantPayroll,
  restoreRecomputeBackup,
} from "@/lib/services/hr/payroll.service";
import type {
  PayrollColumnInput,
  FormulaRow,
} from "@/lib/services/hr/payroll.service";

// Serializable result so client forms can surface a clear, retryable
// message instead of the write silently vanishing on a thrown action.
export type StructureActionResult = { ok: true } | { ok: false; error: string };

// Turn a thrown DB error into a user-facing message. Always logs the raw
// error server-side for diagnosis. The transient case matters most here:
// a Neon compute cold start (after autosuspend) throws P1001 and would
// otherwise lose the write with no indication it didn't save.
function describeStructureDbError(err: unknown, ctx: string): string {
  console.error(`[structures] ${ctx} failed:`, err);
  const code = (err as { code?: string } | null)?.code;
  if (
    code === "P1001" || // can't reach DB server (Neon cold start)
    code === "P1002" || // connection timed out
    code === "P1008" || // operation timed out
    code === "P1017" // server closed the connection
  ) {
    return "The database is waking up — your change was NOT saved. Please try again in a moment.";
  }
  if (code === "P2002") {
    return "That name or code is already in use. Please pick a different one.";
  }
  return "Could not save — something went wrong. Your change was NOT saved; please try again.";
}

// All salary-structure / component mutations are GATED: instead of applying
// the change they raise a `payroll_config` approval whose payload is the
// exact service call to run on approval. Nothing changes until approved.
async function submitPayrollConfig(
  session: { tenantId: string; userId: string; name: string },
  op: string,
  args: unknown[],
  title: string,
  subtitle: string
): Promise<StructureActionResult> {
  try {
    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "payroll_config",
      entityType: "SalaryStructure",
      title,
      subtitle,
      requestedBy: session.userId,
      requestedByName: session.name,
      payload: { op, args },
    });
    revalidatePath("/settings");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to submit for approval",
    };
  }
}

export async function createSalaryStructureAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  const name = formData.get("name") as string;
  return submitPayrollConfig(
    session,
    "createSalaryStructure",
    [{ name, description: (formData.get("description") as string) || undefined }],
    name || "Salary structure",
    "Create salary structure"
  );
}

export async function updateSalaryStructureAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  const description = (formData.get("description") as string)?.trim();
  const name = (formData.get("name") as string).trim();
  return submitPayrollConfig(
    session,
    "updateSalaryStructure",
    [
      formData.get("id") as string,
      {
        name,
        description: description ? description : null,
        isActive: formData.get("isActive") === "true",
      },
    ],
    name || "Salary structure",
    "Update salary structure"
  );
}

export async function addSalaryComponentAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  const name = formData.get("name") as string;
  return submitPayrollConfig(
    session,
    "addSalaryComponent",
    [
      {
        structureId: formData.get("structureId") as string,
        name,
        code: formData.get("code") as string,
        type: formData.get("type") as any,
        calculationType: formData.get("calculationType") as any,
        value: parseFloat(formData.get("value") as string),
        taxable: formData.get("taxable") === "on",
        isStatutory: formData.get("isStatutory") === "on",
      },
    ],
    name || "Salary component",
    "Add salary component"
  );
}

export async function updateSalaryComponentAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  return submitPayrollConfig(
    session,
    "updateSalaryComponent",
    [
      formData.get("id") as string,
      {
        name: (formData.get("name") as string) || undefined,
        code: (formData.get("code") as string) || undefined,
        type: (formData.get("type") as any) || undefined,
        calculationType: (formData.get("calculationType") as any) || undefined,
        value:
          formData.get("value") !== null && formData.get("value") !== ""
            ? parseFloat(formData.get("value") as string)
            : undefined,
      },
    ],
    (formData.get("name") as string) || "Salary component",
    "Update salary component"
  );
}

export async function deleteSalaryComponentAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  try {
    return await submitPayrollConfig(
      session,
      "deleteSalaryComponent",
      [formData.get("id") as string],
      "Salary component",
      "Delete salary component"
    );
  } catch (err) {
    return {
      ok: false,
      error: describeStructureDbError(err, "deleteComponent"),
    };
  }
}

export async function createStandardStructureAction(): Promise<StructureActionResult> {
  const session = await requireTenant();
  try {
    await ensureStandardSalaryStructure(session.tenantId);
    revalidatePath("/settings");
    revalidatePath("/hr/payroll");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: describeStructureDbError(err, "createStandard"),
    };
  }
}

export async function seedStandardAllowanceRowsAction(
  formData: FormData
): Promise<StructureActionResult> {
  const session = await requireTenant();
  try {
    await seedStandardAllowanceRows(
      session.tenantId,
      formData.get("structureId") as string
    );
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: describeStructureDbError(err, "seedAllowances"),
    };
  }
}

export async function runPayrollAction(formData: FormData) {
  const session = await requireTenant();

  // Per-employee payroll adjustments (JSON map of employeeId -> {absentDays,
  // deduction, reason, extraDutyDays}), from the run-payroll adjustments table.
  type Adj = {
    absentDays?: number;
    deduction?: number;
    reason?: string;
    extraDutyDays?: number;
  };
  let adjustments: Record<string, Adj> | undefined;
  const raw = formData.get("adjustments") as string | null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        {
          absentDays?: unknown;
          deduction?: unknown;
          reason?: unknown;
          extraDutyDays?: unknown;
        }
      >;
      const clean: Record<string, Adj> = {};
      for (const [id, v] of Object.entries(parsed)) {
        const row: Adj = {};
        const d = Number(v?.absentDays);
        if (Number.isFinite(d) && d >= 0) row.absentDays = d;
        const ded = Number(v?.deduction);
        if (Number.isFinite(ded) && ded >= 0) row.deduction = ded;
        const ed = Number(v?.extraDutyDays);
        if (Number.isFinite(ed) && ed >= 0) row.extraDutyDays = ed;
        if (typeof v?.reason === "string" && v.reason.trim()) {
          row.reason = v.reason.trim();
        }
        if (Object.keys(row).length > 0) clean[id] = row;
      }
      if (Object.keys(clean).length > 0) adjustments = clean;
    } catch {
      // ignore malformed adjustments — fall back to attendance defaults
    }
  }

  // Gated: deferred. Payroll is NOT run until approved in /admin. The
  // payload is what the approval handler executes on approval.
  const name = formData.get("name") as string;
  try {
    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "payroll_run",
      entityType: "PayrollRun",
      title: name || "Payroll run",
      subtitle: `Period ${formData.get("periodStart")} → ${formData.get("periodEnd")}`,
      requestedBy: session.userId,
      requestedByName: session.name,
      payload: {
        name,
        periodStart: new Date(formData.get("periodStart") as string).toISOString(),
        periodEnd: new Date(formData.get("periodEnd") as string).toISOString(),
        payDate: new Date(formData.get("payDate") as string).toISOString(),
        adjustments: adjustments ?? undefined,
      },
    });
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to submit for approval",
    };
  }
  revalidatePath("/hr/payroll/runs");
  revalidatePath("/hr/payroll");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function updatePayslipAction(formData: FormData) {
  const session = await requireTenant();
  // Only tenant owners/admins may edit a processed salary sheet. Resolve the
  // role live from the DB (the login JWT can be stale).
  const allowed =
    session.isSuperAdmin || (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed) {
    throw new Error("Only tenant owners or admins can edit the salary sheet.");
  }
  const num = (k: string) => {
    const n = parseFloat(formData.get(k) as string);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const runId = formData.get("runId") as string;
  const payslipId = formData.get("payslipId") as string;
  const submittedAdvance = num("advanceRecovered");
  // Capture the stored Advance Recovery BEFORE the update so we only treat it
  // as an installment edit when the admin actually changed that cell (editing
  // Basic etc. must NOT rewrite the advance — that was the old reset bug).
  const beforeAdvance = await getStoredAdvanceRecovered(
    session.tenantId,
    payslipId
  );
  await updatePayslip(session.tenantId, payslipId, {
    basic: num("basic"),
    houseRent: num("houseRent"),
    health: num("health"),
    education: num("education"),
    savings: num("savings"),
    dailyHand: num("dailyHand"),
    extraDutyDays: num("extraDutyDays"),
    absentDays: num("absentDays"),
    advanceRecovered: submittedAdvance,
    absenceReason: (formData.get("absenceReason") as string) || undefined,
  });
  const advanceChanged =
    beforeAdvance === null ||
    Math.round(submittedAdvance * 100) !== Math.round(beforeAdvance * 100);
  if (advanceChanged) {
    // Two-way sync: a salary-sheet Advance Recovery edit writes that amount
    // as the employee's advance installment, then reconciles so the Advances
    // page installment + this run's Advance Recovery match.
    await setEmployeeAdvanceInstallmentFromSheet(
      session.tenantId,
      payslipId,
      submittedAdvance
    );
    revalidatePath("/hr/payroll/advances");
    publishAdvanceChange({
      tenantId: session.tenantId,
      runId,
      kind: "updated",
    });
  }
  if (runId) revalidatePath(`/hr/payroll/runs/${runId}`);
  revalidatePath("/hr/payroll/runs");
  revalidatePath("/hr/payroll");
}

export async function createAdvanceAction(formData: FormData) {
  const session = await requireTenant();
  const amount = parseFloat(formData.get("amount") as string);
  // Optional recovery window (date-range picker). yyyy-MM-dd → UTC date.
  const toDate = (k: string) => {
    const v = (formData.get(k) as string) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const recoveryStart = toDate("recoveryStart");
  const recoveryEnd = toDate("recoveryEnd");
  const hasWindow =
    !!recoveryStart && !!recoveryEnd && recoveryEnd >= recoveryStart;
  // Inclusive month count of the window (e.g. Jan→Mar = 3).
  const windowMonths = hasWindow
    ? (recoveryEnd!.getUTCFullYear() * 12 + recoveryEnd!.getUTCMonth()) -
      (recoveryStart!.getUTCFullYear() * 12 + recoveryStart!.getUTCMonth()) +
      1
    : 0;
  // Recovery inputs are OPTIONAL. Priority:
  //  1. explicit "Monthly recovery" amount, else
  //  2. recovery window → installment = amount / windowMonths, else
  //  3. 0 (set later via Edit).
  const inst = parseFloat(formData.get("installment") as string);
  let installment = 0;
  if (Number.isFinite(inst) && inst > 0) {
    installment = inst;
  } else if (hasWindow && windowMonths > 0 && Number.isFinite(amount) && amount > 0) {
    installment = Math.round((amount / windowMonths) * 100) / 100;
  }
  // Gated: createAdvance now creates the advance PENDING + raises an approval.
  // It is NOT reconciled into payroll until approved in /admin (the approval
  // handler runs syncAdvances/reconcile on approval).
  await createAdvance(
    session.tenantId,
    {
      employeeId: formData.get("employeeId") as string,
      amount,
      installment,
      reason: (formData.get("reason") as string) || undefined,
      issuedAt: new Date(formData.get("issuedAt") as string),
      recoveryStart: hasWindow ? recoveryStart : null,
      recoveryEnd: hasWindow ? recoveryEnd : null,
    },
    { userId: session.userId, name: session.name }
  );
  revalidatePath("/hr/payroll/advances");
  revalidatePath("/hr/payroll");
  revalidatePath("/admin");
}

export async function cancelAdvanceAction(formData: FormData) {
  const session = await requireTenant();
  await cancelAdvance(session.tenantId, formData.get("id") as string);
  await syncAdvances(session.tenantId, "cancelled");
  revalidatePath("/hr/payroll/advances");
  revalidatePath("/hr/payroll");
}

export async function updateAdvanceAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can edit advances." };
  const id = (formData.get("id") as string) ?? "";
  const numOrUndef = (k: string) => {
    const raw = formData.get(k);
    if (raw == null || raw === "") return undefined;
    const n = parseFloat(raw as string);
    return Number.isFinite(n) ? n : undefined;
  };
  try {
    await updateAdvance(session.tenantId, id, {
      amount: numOrUndef("amount"),
      installment: numOrUndef("installment"),
      reason:
        formData.get("reason") != null
          ? ((formData.get("reason") as string) || "")
          : undefined,
    });
    await syncAdvances(session.tenantId, "updated");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  revalidatePath("/hr/payroll/advances");
  revalidatePath("/hr/payroll");
  return { ok: true };
}

export async function assignSalaryAction(formData: FormData) {
  const session = await requireTenant();
  const num = (k: string) => {
    const n = parseFloat(formData.get(k) as string);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const employeeId = formData.get("employeeId") as string;
  // Gated: deferred. The salary is NOT assigned until approved in /admin;
  // the payload below is what the approval handler runs on approval.
  const payload = {
    employeeId,
    structureId: formData.get("structureId") as string,
    baseSalary: parseFloat(formData.get("baseSalary") as string),
    houseRent: num("houseRent"),
    health: num("health"),
    education: num("education"),
    savings: num("savings"),
    dailyHand: num("dailyHand"),
    currency: (formData.get("currency") as string) || "BDT",
    effectiveFrom: new Date(formData.get("effectiveFrom") as string).toISOString(),
  };
  const { prisma } = await import("@/lib/db");
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId: session.tenantId },
    select: { fullName: true, empCode: true },
  });
  await createApprovalRequest({
    tenantId: session.tenantId,
    type: "salary_assignment",
    entityType: "EmployeeSalary",
    title: emp ? `${emp.fullName} (${emp.empCode})` : "Salary assignment",
    subtitle: `Base ${payload.baseSalary.toLocaleString()} ${payload.currency}`,
    requestedBy: session.userId,
    requestedByName: session.name,
    payload,
  });
  revalidatePath("/hr/payroll");
  revalidatePath("/admin");
}

// ─── PERFORMANCE ────────────────────────────────────────────

import {
  createReviewCycle,
  activateCycle,
  closeCycle,
  createGoal,
  updateGoalProgress,
  deleteGoal,
  createReview,
} from "@/lib/services/hr/performance.service";

export async function createCycleAction(formData: FormData) {
  const session = await requireTenant();
  await createReviewCycle(session.tenantId, {
    name: formData.get("name") as string,
    type: (formData.get("type") as string) || "annual",
    startDate: new Date(formData.get("startDate") as string),
    endDate: new Date(formData.get("endDate") as string),
  });
  revalidatePath("/hr/performance/cycles");
}

export async function activateCycleAction(formData: FormData) {
  const session = await requireTenant();
  await activateCycle(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/cycles");
}

export async function closeCycleAction(formData: FormData) {
  const session = await requireTenant();
  await closeCycle(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/cycles");
}

export async function createGoalAction(formData: FormData) {
  const session = await requireTenant();
  await createGoal(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    cycleId: (formData.get("cycleId") as string) || undefined,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    type: formData.get("type") as any,
    targetValue: formData.get("targetValue")
      ? parseFloat(formData.get("targetValue") as string)
      : undefined,
    unit: (formData.get("unit") as string) || undefined,
    weight: formData.get("weight")
      ? parseInt(formData.get("weight") as string, 10)
      : undefined,
  });
  revalidatePath("/hr/performance/goals");
  revalidatePath("/hr/performance");
}

export async function updateGoalAction(formData: FormData) {
  const session = await requireTenant();
  await updateGoalProgress(session.tenantId, formData.get("id") as string, {
    currentValue: formData.get("currentValue")
      ? parseFloat(formData.get("currentValue") as string)
      : undefined,
    progress: formData.get("progress")
      ? parseInt(formData.get("progress") as string, 10)
      : undefined,
  });
  revalidatePath("/hr/performance/goals");
}

export async function deleteGoalAction(formData: FormData) {
  const session = await requireTenant();
  await deleteGoal(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/performance/goals");
}

export async function createReviewAction(formData: FormData) {
  const session = await requireTenant();
  await createReview(session.tenantId, {
    cycleId: formData.get("cycleId") as string,
    employeeId: formData.get("employeeId") as string,
    reviewerId: formData.get("reviewerId") as string,
    type: formData.get("type") as any,
    overallRating: formData.get("overallRating")
      ? parseInt(formData.get("overallRating") as string, 10)
      : undefined,
    strengths: (formData.get("strengths") as string) || undefined,
    improvements: (formData.get("improvements") as string) || undefined,
    comments: (formData.get("comments") as string) || undefined,
  });
  revalidatePath("/hr/performance/reviews");
}

// ─── RECRUITMENT ────────────────────────────────────────────

import {
  createJobPosting,
  changeJobStatus,
  createCandidate,
  createApplication,
  moveApplicationStage,
} from "@/lib/services/hr/recruitment.service";

export async function createJobAction(formData: FormData) {
  const session = await requireTenant();
  const requestedStatus = (formData.get("status") as string) || "draft";

  // Publishing is gated. A job is ALWAYS created as a draft; if the user
  // asked for "Open immediately" we instead raise a job_posting_publish
  // approval — it only goes live once an owner/admin approves it in /admin.
  const job = await createJobPosting(session.tenantId, {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    requirements: (formData.get("requirements") as string) || undefined,
    employmentType: (formData.get("employmentType") as any) ?? "full_time",
    salaryMin: formData.get("salaryMin")
      ? parseFloat(formData.get("salaryMin") as string)
      : undefined,
    salaryMax: formData.get("salaryMax")
      ? parseFloat(formData.get("salaryMax") as string)
      : undefined,
    location: (formData.get("location") as string) || undefined,
    status: "draft",
  });

  if (requestedStatus === "open") {
    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "job_posting_publish",
      entityType: "JobPosting",
      entityId: job.id,
      title: job.title,
      subtitle: "Publish job posting",
      requestedBy: session.userId,
      requestedByName: session.name,
    });
    revalidatePath("/admin");
  }

  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/hr/recruitment");
}

export async function changeJobStatusAction(formData: FormData) {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  // Gated: publishing a job (→ "open") needs approval. Other transitions
  // (draft / on_hold / closed) pass through unchanged.
  if (status === "open") {
    const { prisma } = await import("@/lib/db");
    const job = await prisma.jobPosting.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { title: true },
    });
    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "job_posting_publish",
      entityType: "JobPosting",
      entityId: id,
      title: job?.title ?? "Job posting",
      subtitle: "Publish job posting",
      requestedBy: session.userId,
      requestedByName: session.name,
    });
    revalidatePath("/hr/recruitment/jobs");
    revalidatePath("/admin");
    return;
  }

  await changeJobStatus(session.tenantId, id, status as any);
  revalidatePath("/hr/recruitment/jobs");
}

// Gated job EDIT. The edits are NOT applied immediately: the job is
// unlisted (set to draft so it drops off the recruitment listing) and a
// job_posting_update approval is raised carrying the new field values.
// On approval the fields are applied and the job is re-published (open).
export async function updateJobAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "Missing job id" };
  const title = (formData.get("title") as string)?.trim();
  if (!title || title.length < 2)
    return { ok: false, error: "Title must be at least 2 characters" };

  const numOrNull = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === "") return null;
    const n = parseFloat(v as string);
    return Number.isFinite(n) ? n : null;
  };

  const fields = {
    title,
    description: (formData.get("description") as string)?.trim() || "",
    requirements: (formData.get("requirements") as string)?.trim() || null,
    employmentType: (formData.get("employmentType") as string) || "full_time",
    salaryMin: numOrNull("salaryMin"),
    salaryMax: numOrNull("salaryMax"),
    location: (formData.get("location") as string)?.trim() || null,
  };

  try {
    const { prisma } = await import("@/lib/db");
    const job = await prisma.jobPosting.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!job) return { ok: false, error: "Job not found" };

    // Unlist while the edit is pending (drops off the recruitment listing).
    await prisma.jobPosting.update({
      where: { id },
      data: { status: "draft" },
    });

    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "job_posting_update",
      entityType: "JobPosting",
      entityId: id,
      title,
      subtitle: "Edit job posting",
      requestedBy: session.userId,
      requestedByName: session.name,
      payload: { fields },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to submit for approval",
    };
  }

  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/hr/recruitment");
  revalidatePath("/admin");
  return { ok: true };
}

// Gated job DELETE. The job stays until an owner/admin approves the
// deletion in /admin.
export async function deleteJobAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireTenant();
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "Missing job id" };
  try {
    const { prisma } = await import("@/lib/db");
    const job = await prisma.jobPosting.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { title: true },
    });
    if (!job) return { ok: false, error: "Job not found" };

    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "job_posting_delete",
      entityType: "JobPosting",
      entityId: id,
      title: job.title,
      subtitle: "Delete job posting",
      requestedBy: session.userId,
      requestedByName: session.name,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to submit for approval",
    };
  }
  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/admin");
  return { ok: true };
}

export async function createCandidateAction(formData: FormData) {
  const session = await requireTenant();
  await createCandidate(session.tenantId, {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    currentRole: (formData.get("currentRole") as string) || undefined,
    currentCompany: (formData.get("currentCompany") as string) || undefined,
    linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
    resumeUrl: (formData.get("resumeUrl") as string) || undefined,
    source: (formData.get("source") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });
  revalidatePath("/hr/recruitment/candidates");
}

export async function createApplicationAction(formData: FormData) {
  const session = await requireTenant();
  await createApplication(session.tenantId, {
    candidateId: formData.get("candidateId") as string,
    jobPostingId: formData.get("jobPostingId") as string,
  });
  revalidatePath("/hr/recruitment/pipeline");
}

export async function moveStageAction(formData: FormData) {
  const session = await requireTenant();
  await moveApplicationStage(
    session.tenantId,
    formData.get("id") as string,
    formData.get("stage") as any,
    {
      rejectionReason: (formData.get("rejectionReason") as string) || undefined,
      offerSalary: formData.get("offerSalary")
        ? parseFloat(formData.get("offerSalary") as string)
        : undefined,
    },
    { userId: session.userId, name: session.name }
  );
  revalidatePath("/hr/recruitment/pipeline");
  revalidatePath("/admin");
}

// ─── LEARNING ───────────────────────────────────────────────

import {
  createCourse,
  publishCourse,
  addCourseModule,
  enrollEmployee,
  updateEnrollmentProgress,
} from "@/lib/services/hr/learning.service";

export async function createCourseAction(formData: FormData) {
  const session = await requireTenant();
  await createCourse(session.tenantId, {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    category: (formData.get("category") as string) || undefined,
    durationHours: formData.get("durationHours")
      ? parseInt(formData.get("durationHours") as string, 10)
      : undefined,
    level: (formData.get("level") as any) ?? "beginner",
    instructorName: (formData.get("instructorName") as string) || undefined,
    isPublished: formData.get("isPublished") === "on",
  });
  revalidatePath("/hr/learning/courses");
  revalidatePath("/hr/learning");
}

export async function publishCourseAction(formData: FormData) {
  const session = await requireTenant();
  await publishCourse(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/learning/courses");
}

export async function enrollAction(formData: FormData) {
  const session = await requireTenant();
  await enrollEmployee(session.tenantId, {
    courseId: formData.get("courseId") as string,
    employeeId: formData.get("employeeId") as string,
  });
  revalidatePath("/hr/learning/enrollments");
}

export async function updateProgressAction(formData: FormData) {
  const session = await requireTenant();
  await updateEnrollmentProgress(
    session.tenantId,
    formData.get("id") as string,
    parseInt(formData.get("progress") as string, 10)
  );
  revalidatePath("/hr/learning/enrollments");
}

// ─── DOCUMENTS ──────────────────────────────────────────────

import {
  createDocumentCategory,
  deleteDocumentCategory,
  createDocument,
  markDocumentSigned,
  deleteDocument,
} from "@/lib/services/hr/documents.service";

export async function createDocCategoryAction(formData: FormData) {
  const session = await requireTenant();
  await createDocumentCategory(session.tenantId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    retentionDays: formData.get("retentionDays")
      ? parseInt(formData.get("retentionDays") as string, 10)
      : undefined,
    isRequired: formData.get("isRequired") === "on",
  });
  revalidatePath("/hr/documents/categories");
}

export async function deleteDocCategoryAction(formData: FormData) {
  const session = await requireTenant();
  await deleteDocumentCategory(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/documents/categories");
}

export async function uploadHrDocumentAction(
  formData: FormData
): Promise<{ url: string; name: string; size: number; mime: string; error?: string }> {
  const session = await requireTenant();

  const hdrs = await headers();
  const xf = hdrs.get("x-forwarded-for");
  const ip = xf ? xf.split(",")[0].trim() : hdrs.get("x-real-ip") ?? "unknown";

  const rate = await checkRate("upload", `upload:${session.tenantId}:${ip}`);
  if (!rate.allowed) {
    return { url: "", name: "", size: 0, mime: "", error: `Too many uploads. Try again in ${rate.retryAfterSec}s.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { url: "", name: "", size: 0, mime: "", error: "No file provided" };
  if (!HR_DOC_ALLOWED_MIME.has(file.type)) {
    return { url: "", name: "", size: 0, mime: "", error: "Unsupported file type. Use PDF, Word, Excel, or an image (JPG/PNG/WebP)." };
  }
  if (file.size > HR_DOC_MAX_BYTES) {
    return { url: "", name: "", size: 0, mime: "", error: "File too large (max 15MB)." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const publicId = `rahedeen/${session.tenantId}/hr-doc-${randomUUID()}`;

  const uploadResult = await new Promise<{ secure_url: string } | undefined>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "rahedeen/hr-documents",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as { secure_url: string } | undefined);
        }
      );
      stream.end(bytes);
    }
  ).catch((e) => {
    console.error("[uploadHrDocumentAction] cloudinary:", e);
    return undefined;
  });

  if (!uploadResult) {
    return { url: "", name: "", size: 0, mime: "", error: "Could not save the file. Please try again." };
  }

  return {
    url: uploadResult.secure_url,
    name: file.name,
    size: file.size,
    mime: file.type,
  };
}

export async function createDocumentAction(formData: FormData) {
  const session = await requireTenant();
  const fileSizeRaw = formData.get("fileSize") as string | null;
  const fileSize = fileSizeRaw ? Number(fileSizeRaw) : undefined;
  await createDocument(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    categoryId: (formData.get("categoryId") as string) || undefined,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    fileUrl: (formData.get("fileUrl") as string) || undefined,
    mimeType: (formData.get("mimeType") as string) || undefined,
    fileSize: Number.isFinite(fileSize) ? fileSize : undefined,
    expiresAt: formData.get("expiresAt")
      ? new Date(formData.get("expiresAt") as string)
      : undefined,
    uploadedBy: session.userId,
  });
  revalidatePath("/hr/documents");
}

export async function signDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await markDocumentSigned(
    session.tenantId,
    formData.get("id") as string,
    (formData.get("signedByName") as string) || session.name
  );
  revalidatePath("/hr/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await deleteDocument(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/documents");
}

// ─── Salary-sheet custom columns + paid status ──────────────

type ActionResult = { ok: boolean; error?: string };

function parseColumnForm(formData: FormData): PayrollColumnInput {
  let formula: FormulaRow[] = [];
  try {
    const raw: unknown = JSON.parse(
      (formData.get("formula") as string) || "[]"
    );
    if (Array.isArray(raw)) formula = raw as FormulaRow[];
  } catch {
    // invalid JSON → empty; service validation will reject with a message.
  }
  const manual = formData.get("manual") === "true";
  return {
    name: (formData.get("name") as string) ?? "",
    shortLabel: (formData.get("shortLabel") as string) ?? "",
    group:
      (formData.get("group") as string) === "deduction"
        ? "deduction"
        : "earning",
    formula: manual ? [] : formula,
    manual,
  };
}

export async function createPayrollColumnAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can manage columns." };
  try {
    await createPayrollColumn(session.tenantId, parseColumnForm(formData));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  revalidatePath("/hr/payroll/runs");
  return { ok: true };
}

export async function updatePayrollColumnAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can manage columns." };
  try {
    await updatePayrollColumn(
      session.tenantId,
      formData.get("id") as string,
      parseColumnForm(formData)
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  revalidatePath("/hr/payroll/runs");
  return { ok: true };
}

export async function deletePayrollColumnAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can manage columns." };
  try {
    await deletePayrollColumn(session.tenantId, formData.get("id") as string);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  revalidatePath("/hr/payroll/runs");
  return { ok: true };
}

export async function setPayslipPaidAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can confirm payment." };
  const runId = formData.get("runId") as string | null;
  const payslipId = formData.get("payslipId") as string;
  const paid = formData.get("paid") === "true";
  // Gated: deferred. The payslip is NOT marked paid until approved in /admin.
  try {
    await createApprovalRequest({
      tenantId: session.tenantId,
      type: "payslip_paid",
      entityType: "Payslip",
      entityId: payslipId,
      title: paid ? "Confirm payslip payment" : "Revert payslip payment",
      subtitle: null,
      requestedBy: session.userId,
      requestedByName: session.name,
      payload: { payslipId, paid },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  if (runId) revalidatePath(`/hr/payroll/runs/${runId}`);
  revalidatePath("/hr/payroll/runs");
  revalidatePath("/admin");
  return { ok: true };
}

export async function refreshRunAdvancesAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can refresh advances." };
  const runId = (formData.get("runId") as string) ?? "";
  try {
    await refreshRunAdvances(session.tenantId, runId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  if (runId) revalidatePath(`/hr/payroll/runs/${runId}`);
  publishAdvanceChange({
    tenantId: session.tenantId,
    runId: runId || undefined,
    kind: "refreshed",
  });
  revalidatePath("/hr/payroll/runs");
  return { ok: true };
}

// Void-returning wrapper so it can be used directly as a <form action>.
export async function refreshRunAdvancesFormAction(
  formData: FormData
): Promise<void> {
  await refreshRunAdvancesAction(formData);
}

export async function setPayslipCustomValueAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can edit values." };
  const runId = formData.get("runId") as string | null;
  try {
    await setPayslipCustomValue(
      session.tenantId,
      (formData.get("payslipId") as string) ?? "",
      (formData.get("columnId") as string) ?? "",
      Number(formData.get("value") ?? 0)
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  if (runId) revalidatePath(`/hr/payroll/runs/${runId}`);
  revalidatePath("/hr/payroll/runs");
  return { ok: true };
}

// ─── Built-in (base) column overrides + tenant-wide recompute ───────────
// DESTRUCTIVE: every change here recomputes and OVERWRITES the stored
// payroll figures of EVERY run for the tenant (including completed/paid).
// A pristine baseline + a pre-change restore point are captured first.

type BaseResult = { ok: boolean; error?: string; info?: string };

function parseBaseFormula(formData: FormData): FormulaRow[] | null {
  const raw = (formData.get("formula") as string) || "";
  if (!raw.trim()) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v) && v.length > 0) return v as FormulaRow[];
  } catch {
    /* invalid → null; service validates */
  }
  return null;
}

export async function setBaseColumnAction(
  formData: FormData
): Promise<BaseResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can edit built-in columns." };
  const fieldKey = (formData.get("fieldKey") as string) ?? "";
  const group = formData.get("groupOverride") as string | null;
  try {
    await setBaseColumnOverride(session.tenantId, fieldKey, {
      nameOverride: (formData.get("nameOverride") as string) ?? null,
      shortLabelOverride: (formData.get("shortLabelOverride") as string) ?? null,
      hidden: formData.get("hidden") === "true",
      groupOverride:
        group === "earning" || group === "deduction" ? group : null,
      formula: parseBaseFormula(formData),
    });
    const r = await recomputeTenantPayroll(
      session.tenantId,
      session.userId,
      `Edited built-in column "${fieldKey}"`
    );
    revalidatePath("/hr/payroll/runs");
    return {
      ok: true,
      info: `Recomputed ${r.payslips} payslip(s) across ${r.runs} run(s). A restore point was saved.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function clearBaseColumnAction(
  formData: FormData
): Promise<BaseResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can edit built-in columns." };
  const fieldKey = (formData.get("fieldKey") as string) ?? "";
  try {
    await clearBaseColumnOverride(session.tenantId, fieldKey);
    const r = await recomputeTenantPayroll(
      session.tenantId,
      session.userId,
      `Reset built-in column "${fieldKey}" to default`
    );
    revalidatePath("/hr/payroll/runs");
    return {
      ok: true,
      info: `Reset to default. Recomputed ${r.payslips} payslip(s) across ${r.runs} run(s).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function restoreRecomputeBackupAction(
  formData: FormData
): Promise<BaseResult> {
  const session = await requireTenant();
  const allowed =
    session.isSuperAdmin ||
    (await isTenantAdmin(session.tenantId, session.userId));
  if (!allowed)
    return { ok: false, error: "Only owners/admins can restore payroll." };
  try {
    const r = await restoreRecomputeBackup(
      session.tenantId,
      (formData.get("backupId") as string) ?? ""
    );
    revalidatePath("/hr/payroll/runs");
    return {
      ok: true,
      info: `Restored ${r.payslips} payslip(s) across ${r.runs} run(s).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
