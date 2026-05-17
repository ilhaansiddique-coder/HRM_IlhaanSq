"use server";

import { requireTenant } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { publishAdvanceChange, type AdvanceChangeKind } from "@/lib/realtime/bus";

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
  ensureStandardSalaryStructure,
  addSalaryComponent,
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

export async function createSalaryStructureAction(formData: FormData) {
  const session = await requireTenant();
  await createSalaryStructure(session.tenantId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  });
  revalidatePath("/hr/payroll/structures");
}

export async function addSalaryComponentAction(formData: FormData) {
  const session = await requireTenant();
  await addSalaryComponent(session.tenantId, {
    structureId: formData.get("structureId") as string,
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    type: formData.get("type") as any,
    calculationType: formData.get("calculationType") as any,
    value: parseFloat(formData.get("value") as string),
    taxable: formData.get("taxable") === "on",
    isStatutory: formData.get("isStatutory") === "on",
  });
  revalidatePath("/hr/payroll/structures");
}

export async function deleteSalaryComponentAction(formData: FormData) {
  const session = await requireTenant();
  await deleteSalaryComponent(session.tenantId, formData.get("id") as string);
  revalidatePath("/hr/payroll/structures");
}

export async function createStandardStructureAction() {
  const session = await requireTenant();
  await ensureStandardSalaryStructure(session.tenantId);
  revalidatePath("/hr/payroll/structures");
  revalidatePath("/hr/payroll");
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

  const result = await runPayroll(session.tenantId, {
    name: formData.get("name") as string,
    periodStart: new Date(formData.get("periodStart") as string),
    periodEnd: new Date(formData.get("periodEnd") as string),
    payDate: new Date(formData.get("payDate") as string),
    runBy: session.userId,
    adjustments,
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  revalidatePath("/hr/payroll/runs");
  revalidatePath("/hr/payroll");
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
  // Monthly recovery is optional at creation — blank/invalid means "no
  // recovery scheduled yet"; an admin sets it later via the Edit pencil.
  const inst = parseFloat(formData.get("installment") as string);
  await createAdvance(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    amount: parseFloat(formData.get("amount") as string),
    installment: Number.isFinite(inst) && inst > 0 ? inst : 0,
    reason: (formData.get("reason") as string) || undefined,
    issuedAt: new Date(formData.get("issuedAt") as string),
  });
  await syncAdvances(session.tenantId, "created");
  revalidatePath("/hr/payroll/advances");
  revalidatePath("/hr/payroll");
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
  await assignSalary(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    structureId: formData.get("structureId") as string,
    baseSalary: parseFloat(formData.get("baseSalary") as string),
    houseRent: num("houseRent"),
    health: num("health"),
    education: num("education"),
    savings: num("savings"),
    dailyHand: num("dailyHand"),
    currency: (formData.get("currency") as string) || "BDT",
    effectiveFrom: new Date(formData.get("effectiveFrom") as string),
  });
  revalidatePath("/hr/payroll");
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
  await createJobPosting(session.tenantId, {
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
    status: (formData.get("status") as any) ?? "draft",
  });
  revalidatePath("/hr/recruitment/jobs");
  revalidatePath("/hr/recruitment");
}

export async function changeJobStatusAction(formData: FormData) {
  const session = await requireTenant();
  await changeJobStatus(
    session.tenantId,
    formData.get("id") as string,
    formData.get("status") as any
  );
  revalidatePath("/hr/recruitment/jobs");
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
    }
  );
  revalidatePath("/hr/recruitment/pipeline");
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

export async function createDocumentAction(formData: FormData) {
  const session = await requireTenant();
  await createDocument(session.tenantId, {
    employeeId: formData.get("employeeId") as string,
    categoryId: (formData.get("categoryId") as string) || undefined,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    fileUrl: (formData.get("fileUrl") as string) || undefined,
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
  try {
    await setPayslipPaid(
      session.tenantId,
      formData.get("payslipId") as string,
      formData.get("paid") === "true",
      session.userId
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
  if (runId) revalidatePath(`/hr/payroll/runs/${runId}`);
  revalidatePath("/hr/payroll/runs");
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
