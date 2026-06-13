import { prisma } from "../db";
import { createNotification } from "./notifications-center.service";

// ─── Generic approval framework ─────────────────────────────
//
// `ApprovalRequest.type` is a free-form string. There are two patterns:
//
//  • status-gate  — an entity row already exists in a pending state; the
//    decision flips its status (employee_onboarding, recruitment_joining,
//    leave_request, employee_advance, job_posting_publish).
//
//  • deferred-call — there is no row yet; `payload` holds everything needed
//    to perform the action on approval (salary_assignment, customer_payment,
//    payroll_config, payroll_run, payslip_paid).
//
// Adding a new approval kind = add a case in applyDecision + a label here.
// NO schema migration is ever needed again.

export type ApprovalDecision = "approved" | "rejected";

const LABELS: Record<string, string> = {
  employee_onboarding: "New employee",
  recruitment_joining: "Candidate joining",
  leave_request: "Leave request",
  employee_advance: "Employee advance",
  job_posting_publish: "Job posting publish",
  job_posting_update: "Job posting edit",
  job_posting_delete: "Job posting delete",
  salary_assignment: "Salary assignment",
  customer_payment: "Customer payment",
  payroll_config: "Payroll configuration",
  payroll_run: "Payroll run",
  payslip_paid: "Payslip payment",
};

export function approvalLabel(type: string): string {
  if (LABELS[type]) return LABELS[type];
  const s = type.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type EditableJob = {
  title: string;
  location: string;
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  requirements: string;
};

export type EditableField = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "textarea";
  value: string;
};

export type ApprovalDetail = {
  typeLabel: string;
  // Current state of the underlying record (what exists today).
  current: { label: string; value: string }[];
  // Proposed change (for edits / deferred actions). Null = nothing proposed.
  proposed: { label: string; value: string }[] | null;
  note: string | null;
  // For job publish/edit approvals: the proposed values as an EDITABLE form
  // the admin can adjust and approve with their own version. Null = the
  // proposal is not admin-editable (e.g. delete, or non-job approvals).
  editableJob: EditableJob | null;
  // Generic admin-editable payload (salary assignment, payroll run): the
  // admin can adjust these before approving. Null = not editable.
  editableFields: EditableField[] | null;
};

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function money(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

// Fetch a reviewable snapshot for an approval so an admin can actually
// inspect the thing before deciding. Job approvals get full detail; other
// kinds fall back to the request payload / basics.
export async function getApprovalDetail(
  tenantId: string,
  id: string
): Promise<ApprovalDetail> {
  const req = await prisma.approvalRequest.findFirst({
    where: { id, tenantId },
  });
  if (!req) throw new Error("Approval request not found");

  const out: ApprovalDetail = {
    typeLabel: approvalLabel(req.type),
    current: [],
    proposed: null,
    note: null,
    editableJob: null,
    editableFields: null,
  };
  const p = (req.payload ?? {}) as Record<string, any>;

  if (req.type.startsWith("job_posting") && req.entityId) {
    const job = await prisma.jobPosting.findFirst({
      where: { id: req.entityId, tenantId },
      include: { _count: { select: { applications: true } } },
    });
    if (!job) {
      out.note = "The job posting no longer exists.";
      return out;
    }
    out.current = [
      { label: "Title", value: job.title },
      { label: "Status", value: job.status },
      { label: "Type", value: job.employmentType.replace("_", "-") },
      { label: "Location", value: job.location ?? "—" },
      {
        label: "Salary",
        value:
          job.salaryMin || job.salaryMax
            ? `${job.currency} ${money(job.salaryMin)} – ${money(job.salaryMax)}`
            : "Negotiable",
      },
      { label: "Applicants", value: String(job._count.applications) },
      { label: "Description", value: job.description || "—" },
      { label: "Requirements", value: job.requirements || "—" },
    ];
    if (req.type === "job_posting_update" && p.fields) {
      const f = p.fields as Record<string, any>;
      out.proposed = [
        { label: "Title", value: f.title ?? job.title },
        {
          label: "Type",
          value: String(f.employmentType ?? job.employmentType).replace("_", "-"),
        },
        { label: "Location", value: f.location ?? "—" },
        {
          label: "Salary",
          value: `${job.currency} ${money(f.salaryMin)} – ${money(f.salaryMax)}`,
        },
        { label: "Description", value: f.description || "—" },
        { label: "Requirements", value: f.requirements || "—" },
      ];
      out.note = "Approving applies these changes and re-publishes the job.";
    } else if (req.type === "job_posting_delete") {
      out.note =
        "Approving permanently deletes this job posting and its applications.";
    } else if (req.type === "job_posting_publish") {
      out.note = "Approving makes this job live on the recruitment list.";
    }

    // Publish & edit are admin-editable: prefill from the proposal (edit) or
    // the job itself (publish). The admin can adjust and approve their own
    // version — the proposal is preserved, not reset.
    if (req.type === "job_posting_publish" || req.type === "job_posting_update") {
      const f =
        req.type === "job_posting_update" && p.fields
          ? (p.fields as Record<string, any>)
          : {};
      out.editableJob = {
        title: f.title ?? job.title,
        location: f.location ?? job.location ?? "",
        employmentType: f.employmentType ?? job.employmentType,
        salaryMin:
          f.salaryMin != null
            ? String(f.salaryMin)
            : job.salaryMin != null
              ? String(Number(job.salaryMin))
              : "",
        salaryMax:
          f.salaryMax != null
            ? String(f.salaryMax)
            : job.salaryMax != null
              ? String(Number(job.salaryMax))
              : "",
        description: f.description ?? job.description ?? "",
        requirements: f.requirements ?? job.requirements ?? "",
      };
    }
    return out;
  }

  if (req.type === "salary_assignment") {
    const [emp, structure] = await Promise.all([
      p.employeeId
        ? prisma.employee.findFirst({
            where: { id: p.employeeId, tenantId },
            select: { fullName: true, empCode: true },
          })
        : null,
      p.structureId
        ? prisma.salaryStructure.findFirst({
            where: { id: p.structureId, tenantId },
            select: { name: true },
          })
        : null,
    ]);
    out.current = [
      {
        label: "Employee",
        value: emp ? `${emp.fullName} (${emp.empCode})` : "—",
      },
      { label: "Salary structure", value: structure?.name ?? "—" },
    ];
    out.editableFields = [
      { name: "baseSalary", label: "Base salary", type: "number", value: String(p.baseSalary ?? "") },
      { name: "houseRent", label: "House rent", type: "number", value: String(p.houseRent ?? 0) },
      { name: "health", label: "Health", type: "number", value: String(p.health ?? 0) },
      { name: "education", label: "Education", type: "number", value: String(p.education ?? 0) },
      { name: "savings", label: "Savings", type: "number", value: String(p.savings ?? 0) },
      { name: "dailyHand", label: "Daily hand", type: "number", value: String(p.dailyHand ?? 0) },
      { name: "currency", label: "Currency", type: "text", value: String(p.currency ?? "BDT") },
      { name: "effectiveFrom", label: "Effective from", type: "date", value: toDateInput(p.effectiveFrom) },
    ];
    out.note = "Approving assigns this salary. You may adjust the figures first.";
    return out;
  }

  if (req.type === "payroll_run") {
    out.current = [
      { label: "Run name", value: String(p.name ?? "—") },
      { label: "Period", value: `${toDateInput(p.periodStart)} → ${toDateInput(p.periodEnd)}` },
      { label: "Pay date", value: toDateInput(p.payDate) },
    ];
    out.editableFields = [
      { name: "name", label: "Run name", type: "text", value: String(p.name ?? "") },
      { name: "periodStart", label: "Period start", type: "date", value: toDateInput(p.periodStart) },
      { name: "periodEnd", label: "Period end", type: "date", value: toDateInput(p.periodEnd) },
      { name: "payDate", label: "Pay date", type: "date", value: toDateInput(p.payDate) },
    ];
    out.note =
      "Approving runs payroll for this period. Per-employee adjustments from the original submission are kept.";
    return out;
  }

  // Generic fallback: show the request payload (deferred actions) and basics.
  if (req.subtitle) out.current.push({ label: "Summary", value: req.subtitle });
  const keys = Object.keys(p);
  if (keys.length) {
    out.proposed = keys
      .filter((k) => typeof p[k] !== "object")
      .map((k) => ({ label: k, value: String(p[k]) }));
    if (!out.proposed.length) out.proposed = null;
  }
  return out;
}

export async function listApprovalRequests(
  tenantId: string,
  filters: { status?: string; type?: string } = {}
) {
  const rows = await prisma.approvalRequest.findMany({
    where: {
      tenantId,
      ...(filters.status && { status: filters.status as never }),
      ...(filters.type && { type: filters.type }),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    typeLabel: approvalLabel(r.type),
    status: r.status,
    entityType: r.entityType,
    entityId: r.entityId,
    title: r.title,
    subtitle: r.subtitle,
    requestedByName: r.requestedByName,
    decidedByName: r.decidedByName,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getApprovalStats(tenantId: string) {
  const [pending, approved, rejected] = await Promise.all([
    prisma.approvalRequest.count({ where: { tenantId, status: "pending" } }),
    prisma.approvalRequest.count({ where: { tenantId, status: "approved" } }),
    prisma.approvalRequest.count({ where: { tenantId, status: "rejected" } }),
  ]);
  return { pending, approved, rejected };
}

// Raise an approval request + emit a notification. Used by every gated flow.
export async function createApprovalRequest(input: {
  tenantId: string;
  type: string;
  entityType: string;
  entityId?: string | null;
  title: string;
  subtitle?: string | null;
  requestedBy?: string | null;
  requestedByName?: string | null;
  payload?: unknown;
}) {
  const req = await prisma.approvalRequest.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      title: input.title,
      subtitle: input.subtitle ?? null,
      requestedBy: input.requestedBy ?? null,
      requestedByName: input.requestedByName ?? null,
      payload: (input.payload ?? undefined) as never,
    },
  });

  await createNotification({
    tenantId: input.tenantId,
    category: "approval",
    type: `approval.${input.type}.requested`,
    title: `${approvalLabel(input.type)} awaiting approval`,
    body: input.subtitle ? `${input.title} · ${input.subtitle}` : input.title,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    link: "/admin",
    actorId: input.requestedBy,
    actorName: input.requestedByName,
    severity: "warning",
  });

  return req;
}

type ApprovalRow = {
  id: string;
  tenantId: string;
  type: string;
  entityId: string | null;
  payload: unknown;
};

// Perform the real-world side effect of a decision. Feature services are
// imported lazily so this module stays a leaf (no circular imports).
async function applyDecision(
  req: ApprovalRow,
  decision: ApprovalDecision,
  decider: { userId: string; name: string },
  reason: string | undefined,
  now: Date
) {
  const tenantId = req.tenantId;
  const p = (req.payload ?? {}) as Record<string, any>;

  switch (req.type) {
    case "employee_onboarding": {
      if (!req.entityId) return;
      if (decision === "approved") {
        // Approved, but NOT active yet — the employee must verify their
        // email + set a password first. Email verification flips status to
        // "active". (Decision: admin approve → email verify → active.)
        await prisma.employee.update({
          where: { id: req.entityId },
          data: {
            approvalStatus: "approved",
            approvalDecidedBy: decider.userId,
            approvalDecidedAt: now,
            approvalRejectionReason: null,
          },
        });
        try {
          const onboarding = await import("./employee-onboarding.service");
          await onboarding.provisionEmployeeAccount(tenantId, req.entityId);
        } catch (e) {
          console.error("[approvals] employee provisioning failed:", e);
        }
      } else {
        await prisma.employee.update({
          where: { id: req.entityId },
          data: {
            approvalStatus: "rejected",
            approvalDecidedBy: decider.userId,
            approvalDecidedAt: now,
            approvalRejectionReason: reason ?? null,
          },
        });
      }
      return;
    }

    case "recruitment_joining": {
      if (!req.entityId) return;
      await prisma.application.update({
        where: { id: req.entityId },
        data:
          decision === "approved"
            ? {
                joiningStatus: "approved",
                stage: "hired",
                hiredAt: now,
                joiningDecidedBy: decider.userId,
                joiningDecidedAt: now,
                joiningRejectionReason: null,
              }
            : {
                joiningStatus: "rejected",
                joiningDecidedBy: decider.userId,
                joiningDecidedAt: now,
                joiningRejectionReason: reason ?? null,
              },
      });
      return;
    }

    case "leave_request": {
      if (!req.entityId) return;
      const leave = await import("./hr/leave.service");
      try {
        if (decision === "approved") {
          await leave.approveLeaveRequest(tenantId, req.entityId, decider.userId);
        } else {
          await leave.rejectLeaveRequest(
            tenantId,
            req.entityId,
            decider.userId,
            reason
          );
        }
      } catch {
        // Leave may already have been reviewed on the /hr/leave page —
        // closing the approval row here is still correct.
      }
      return;
    }

    case "employee_advance": {
      if (!req.entityId) return;
      if (decision === "approved") {
        await prisma.employeeAdvance.update({
          where: { id: req.entityId },
          data: { status: "active" },
        });
        // Pull the now-active advance into open payroll runs + live-refresh
        // any open salary sheets (mirrors the advance-create flow).
        try {
          const payroll = await import("./hr/payroll.service");
          await payroll.reconcileRunAdvancesForTenant(tenantId);
          const bus = await import("../realtime/bus");
          bus.publishAdvanceChange({ tenantId, kind: "created" });
        } catch {
          /* reconcile/realtime are best-effort */
        }
      } else {
        await prisma.employeeAdvance.update({
          where: { id: req.entityId },
          data: { status: "cancelled" },
        });
      }
      return;
    }

    case "job_posting_publish": {
      if (!req.entityId) return;
      if (decision === "approved") {
        await prisma.jobPosting.update({
          where: { id: req.entityId },
          data: { status: "open", openedAt: now },
        });
      }
      return;
    }

    case "job_posting_update": {
      if (decision !== "approved" || !req.entityId) return;
      const rec = await import("./hr/recruitment.service");
      // Apply the edited fields, then re-publish so it's listed again.
      await rec.updateJobPosting(tenantId, req.entityId, {
        ...(p.fields ?? {}),
        status: "open",
      });
      return;
    }

    case "job_posting_delete": {
      if (decision !== "approved" || !req.entityId) return;
      const rec = await import("./hr/recruitment.service");
      await rec.deleteJobPosting(tenantId, req.entityId);
      return;
    }

    case "salary_assignment": {
      if (decision !== "approved") return;
      const payroll = await import("./hr/payroll.service");
      await payroll.assignSalary(tenantId, {
        ...p,
        effectiveFrom: p.effectiveFrom ? new Date(p.effectiveFrom) : new Date(),
      } as never);
      return;
    }

    case "payroll_run": {
      if (decision !== "approved") return;
      const payroll = await import("./hr/payroll.service");
      await payroll.runPayroll(tenantId, {
        ...p,
        periodStart: new Date(p.periodStart),
        periodEnd: new Date(p.periodEnd),
        payDate: new Date(p.payDate),
        runBy: decider.userId,
      } as never);
      return;
    }

    case "payslip_paid": {
      if (decision !== "approved") return;
      const payroll = await import("./hr/payroll.service");
      await payroll.setPayslipPaid(
        tenantId,
        p.payslipId,
        Boolean(p.paid),
        decider.userId
      );
      return;
    }

    case "payroll_config": {
      if (decision !== "approved") return;
      const payroll: Record<string, any> = await import("./hr/payroll.service");
      const ALLOWED = new Set([
        "createSalaryStructure",
        "updateSalaryStructure",
        "addSalaryComponent",
        "updateSalaryComponent",
        "deleteSalaryComponent",
      ]);
      const op = String(p.op);
      if (!ALLOWED.has(op) || typeof payroll[op] !== "function") {
        throw new Error(`Unknown payroll config operation: ${op}`);
      }
      await payroll[op](tenantId, ...(Array.isArray(p.args) ? p.args : [p.args]));
      return;
    }

    default:
      // Unknown type: close the request without a side effect rather than
      // crash the inbox.
      return;
  }
}

async function decide(
  tenantId: string,
  approvalId: string,
  decision: ApprovalDecision,
  decider: { userId: string; name: string },
  reason?: string
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, tenantId },
  });
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending")
    throw new Error("This request has already been decided");

  const now = new Date();

  await applyDecision(
    {
      id: req.id,
      tenantId: req.tenantId,
      type: req.type,
      entityId: req.entityId,
      payload: req.payload,
    },
    decision,
    decider,
    reason,
    now
  );

  const updated = await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: decision,
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: now,
      reason: reason ?? null,
    },
  });

  await createNotification({
    tenantId,
    category: "approval",
    type: `approval.${req.type}.${decision}`,
    title: `${req.title} — ${decision}`,
    body: req.subtitle,
    entityType: req.entityType,
    entityId: req.entityId,
    link: "/admin",
    actorId: decider.userId,
    actorName: decider.name,
    severity: decision === "approved" ? "success" : "warning",
  });

  return updated;
}

export function approveRequest(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string }
) {
  return decide(tenantId, id, "approved", decider);
}

export function rejectRequest(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string },
  reason?: string
) {
  return decide(tenantId, id, "rejected", decider, reason);
}

// Admin approves a job publish/edit with their OWN edited values instead of
// the submitter's exact proposal. The proposal is not reset — the admin form
// is prefilled with it and the admin writes the final version here.
export async function approveJobWithEdits(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string },
  fields: {
    title: string;
    location: string;
    employmentType: string;
    salaryMin: string;
    salaryMax: string;
    description: string;
    requirements: string;
  }
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id, tenantId },
  });
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending")
    throw new Error("This request has already been decided");
  if (
    !req.entityId ||
    (req.type !== "job_posting_publish" && req.type !== "job_posting_update")
  ) {
    throw new Error("This approval does not support editable approval");
  }

  const num = (v: string) => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const rec = await import("./hr/recruitment.service");
  await rec.updateJobPosting(tenantId, req.entityId, {
    title: fields.title,
    description: fields.description,
    requirements: fields.requirements || null,
    employmentType: fields.employmentType,
    salaryMin: num(fields.salaryMin),
    salaryMax: num(fields.salaryMax),
    location: fields.location || null,
    status: "open",
  });

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: "approved",
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: new Date(),
      reason: "Approved with admin edits",
    },
  });

  await createNotification({
    tenantId,
    category: "approval",
    type: `approval.${req.type}.approved`,
    title: `${req.title} — approved (admin-edited)`,
    body: "Approved with changes written by the admin.",
    entityType: req.entityType,
    entityId: req.entityId,
    link: "/admin",
    actorId: decider.userId,
    actorName: decider.name,
    severity: "success",
  });

  return updated;
}

// Approve an employee_onboarding request WITHOUT the email round-trip: provision
// the account + mark the employee active immediately, then resolve the request.
// Returns a one-time temp password (for a new account) so the admin can hand it
// over. Used when SMTP isn't configured or the admin wants instant activation.
export async function approveOnboardingDirect(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string }
): Promise<{ email: string; tempPassword: string | null; reused: boolean }> {
  const req = await prisma.approvalRequest.findFirst({ where: { id, tenantId } });
  if (!req) throw new Error("Request not found");
  if (req.type !== "employee_onboarding")
    throw new Error("Not an employee onboarding request");
  if (req.status !== "pending") throw new Error("This request is already decided");
  if (!req.entityId) throw new Error("No employee linked to this request");

  const onboarding = await import("./employee-onboarding.service");
  const result = await onboarding.activateEmployeeWithoutEmail(
    tenantId,
    req.entityId,
    decider
  );

  await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: "approved",
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: new Date(),
      reason: "Activated directly (no email verification)",
    },
  });

  return result;
}

// Admin approves a deferred-action approval (salary assignment / payroll
// run) with their OWN adjusted figures. Non-editable parts of the original
// payload (employee/structure ids, per-employee payroll adjustments) are
// preserved; only the admin-editable fields are overlaid.
export async function approveWithPayloadEdits(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string },
  values: Record<string, string>
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id, tenantId },
  });
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending")
    throw new Error("This request has already been decided");

  const p = (req.payload ?? {}) as Record<string, any>;
  const numOr = (v: string, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  if (req.type === "salary_assignment") {
    const payroll = await import("./hr/payroll.service");
    await payroll.assignSalary(tenantId, {
      employeeId: p.employeeId,
      structureId: p.structureId,
      baseSalary: numOr(values.baseSalary),
      houseRent: numOr(values.houseRent),
      health: numOr(values.health),
      education: numOr(values.education),
      savings: numOr(values.savings),
      dailyHand: numOr(values.dailyHand),
      currency: values.currency || "BDT",
      effectiveFrom: values.effectiveFrom
        ? new Date(values.effectiveFrom)
        : new Date(),
    } as never);
  } else if (req.type === "payroll_run") {
    const payroll = await import("./hr/payroll.service");
    const result: any = await payroll.runPayroll(tenantId, {
      name: values.name || p.name || "Payroll run",
      periodStart: new Date(values.periodStart || p.periodStart),
      periodEnd: new Date(values.periodEnd || p.periodEnd),
      payDate: new Date(values.payDate || p.payDate),
      runBy: decider.userId,
      adjustments: p.adjustments ?? undefined,
    } as never);
    if (result && result.ok === false) {
      throw new Error(result.error || "Payroll run failed");
    }
  } else {
    throw new Error("This approval does not support editable approval");
  }

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: "approved",
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: new Date(),
      reason: "Approved with admin edits",
    },
  });

  await createNotification({
    tenantId,
    category: "approval",
    type: `approval.${req.type}.approved`,
    title: `${req.title} — approved (admin-edited)`,
    body: "Approved with figures adjusted by the admin.",
    entityType: req.entityType,
    entityId: req.entityId,
    link: "/admin",
    actorId: decider.userId,
    actorName: decider.name,
    severity: "success",
  });

  return updated;
}

// Admin sends the request back to whoever submitted it with a
// recommendation. No side effect runs (nothing is applied or deleted); the
// row leaves the pending queue (status=rejected) carrying the note, and the
// requester is notified to revise & resubmit — resubmitting raises a fresh
// approval.
export async function requestChanges(
  tenantId: string,
  id: string,
  decider: { userId: string; name: string },
  recommendation: string
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id, tenantId },
  });
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending")
    throw new Error("This request has already been decided");

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: "rejected",
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: new Date(),
      reason: recommendation
        ? `Changes requested: ${recommendation}`
        : "Changes requested",
    },
  });

  await createNotification({
    tenantId,
    category: "approval",
    type: `approval.${req.type}.changes_requested`,
    title: `${req.title} — changes requested`,
    body: recommendation || "Please revise and resubmit.",
    entityType: req.entityType,
    entityId: req.entityId,
    link: "/admin",
    actorId: req.requestedBy,
    actorName: decider.name,
    severity: "warning",
  });

  return updated;
}

// Close the pending approval that mirrors an entity whose decision was made
// directly elsewhere (e.g. the /hr/leave page) — WITHOUT re-running the side
// effect. Keeps the central inbox consistent with feature-page actions.
export async function resolveLinkedApproval(
  tenantId: string,
  type: string,
  entityId: string,
  decision: ApprovalDecision,
  decider: { userId: string; name: string },
  reason?: string
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { tenantId, type, entityId, status: "pending" },
  });
  if (!req) return;

  await prisma.approvalRequest.update({
    where: { id: req.id },
    data: {
      status: decision,
      decidedBy: decider.userId,
      decidedByName: decider.name,
      decidedAt: new Date(),
      reason: reason ?? null,
    },
  });

  await createNotification({
    tenantId,
    category: "approval",
    type: `approval.${type}.${decision}`,
    title: `${req.title} — ${decision}`,
    body: req.subtitle,
    entityType: req.entityType,
    entityId: req.entityId,
    link: "/admin",
    actorId: decider.userId,
    actorName: decider.name,
    severity: decision === "approved" ? "success" : "warning",
  });
}
