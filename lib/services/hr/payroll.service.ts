import { Prisma, type PayrollPeriod } from "@prisma/client";
import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";
import {
  countLateToAbsenceBatch,
  getLateToAbsenceDetail,
  isWeeklyHoliday,
} from "./attendance.service";
import { createApprovalRequest } from "../approvals.service";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Structure-driven allowances (constrained 5-slot model) ─────────────
// The salary sheet, recompute engine and Payslip table are hardwired to a
// fixed set of codes/columns. Rather than rebuild that, a structure may
// define an *earning* component for each of these 5 known codes; its rule
// then drives that allowance for FUTURE runs. Each maps 1:1 to a Payslip
// column + salary-sheet line code, so the sheet stays untouched. `Basic`
// is intentionally NOT here — it differs per employee and stays the
// per-employee anchor (EmployeeSalary.baseSalary).
const ALLOWANCE_SLOTS = [
  { code: "HRENT", field: "houseRent", label: "House Rent", sortOrder: 10 },
  { code: "HEALTH", field: "health", label: "Health Allowance", sortOrder: 20 },
  { code: "EDU", field: "education", label: "Education Allowance", sortOrder: 30 },
  { code: "SAV", field: "savings", label: "Savings", sortOrder: 40 },
  { code: "DHEXP", field: "dailyHand", label: "Daily Hand Expenses", sortOrder: 50 },
] as const;
const ALLOWANCE_CODES: readonly string[] = ALLOWANCE_SLOTS.map((s) => s.code);

type AllowanceAmounts = {
  houseRent: number;
  health: number;
  education: number;
  savings: number;
  dailyHand: number;
};

// Resolve the 5 allowance amounts for one employee. Per slot: if the
// structure defines an earning rule for that code, the rule wins (fixed →
// flat value; percent_of_basic → basic × value%); otherwise fall back to
// the employee's own stored amount. So a structure with NO components
// behaves exactly like today (per-employee), and adding a rule overrides
// that slot for everyone on the structure. `percent_of_gross` is invalid
// for an allowance (gross depends on it) → ignored, employee value kept.
function resolveAllowances(
  components: ReadonlyArray<{
    code: string;
    type: string;
    calculationType: string;
    value: Prisma.Decimal | number;
  }>,
  basic: number,
  perEmployee: AllowanceAmounts
): AllowanceAmounts {
  const byCode = new Map(
    components
      .filter((c) => c.type === "earning" && ALLOWANCE_CODES.includes(c.code))
      .map((c) => [c.code, c])
  );
  const out: AllowanceAmounts = { ...perEmployee };
  for (const slot of ALLOWANCE_SLOTS) {
    const c = byCode.get(slot.code);
    if (!c) continue; // no rule → keep the per-employee amount
    const v = Number(c.value);
    if (c.calculationType === "fixed") out[slot.field] = round2(v);
    else if (c.calculationType === "percent_of_basic")
      out[slot.field] = round2((basic * v) / 100);
    // percent_of_gross intentionally unsupported here — keep employee value
  }
  return out;
}

/**
 * HRM_IlhaanSq "terms of payment" (derived from the company salary sheet):
 *
 *   Gross Salary      = Basic + House Rent + Health + Education + Savings
 *                       + Daily Hand Expenses        (per-employee amounts)
 *   Extra Duty Payment = (Basic / 30) * extra-duty days
 *   Total Salary       = Gross + Extra Duty Payment
 *   Absence Deduction  = (Basic / 30) * absent days
 *   Advance Recovered  = installment recovered from the active advance ledger
 *   Payable Salary     = Total Salary − Advance − Absence − other deductions
 *
 * Allowances vary per employee, so they live on EmployeeSalary (set when a
 * salary is assigned), not as fixed salary-structure components.
 */

// ─── Salary Structures ──────────────────────────────────────

export async function listSalaryStructures(tenantId: string) {
  return prisma.salaryStructure.findMany({
    where: { tenantId },
    include: {
      components: { orderBy: { sortOrder: "asc" } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSalaryStructure(
  tenantId: string,
  input: { name: string; description?: string }
) {
  return prisma.salaryStructure.create({
    data: { tenantId, name: input.name, description: input.description },
  });
}

// Edit an existing structure's own fields (not its components). Tenant-scoped
// so one tenant can't touch another's structure. A duplicate name collides on
// the @@unique([tenantId, name]) constraint → P2002, surfaced to the user.
export async function updateSalaryStructure(
  tenantId: string,
  id: string,
  input: { name: string; description: string | null; isActive: boolean }
) {
  const existing = await prisma.salaryStructure.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) throw new Error("Structure not found");

  return prisma.salaryStructure.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      isActive: input.isActive,
    },
  });
}

const STRUCTURE_NAME = "Standard Monthly Salary (HRM_IlhaanSq)";
const STRUCTURE_DESC =
  "Earnings for future payroll runs are driven by this structure's allowance rules (House Rent, Health, Education, Savings, Daily Hand). Basic is per-employee. A slot with no rule falls back to the employee's own amount. Extra duty added, advance & absence deducted at payroll-run time.";

type ComponentType = "earning" | "deduction" | "reimbursement";
type ComponentCalc = "fixed" | "percent_of_basic" | "percent_of_gross";

// Guard what a component can be. Earnings must use one of the 5 known
// allowance codes (anything else is silently dropped by the fixed salary
// sheet, so we reject it loudly) and can't be % of gross (gross depends on
// the allowance). Deductions are unconstrained — the sheet supports custom
// deductions. Reimbursements aren't wired into payroll yet.
function assertValidComponent(input: {
  type: ComponentType;
  code: string;
  calculationType: ComponentCalc;
}) {
  if (input.type === "reimbursement") {
    throw new Error(
      "Reimbursement components aren't supported in payroll yet."
    );
  }
  if (input.type === "earning") {
    if (!ALLOWANCE_CODES.includes(input.code.toUpperCase())) {
      throw new Error(
        `An earning rule must use a standard allowance code (${ALLOWANCE_CODES.join(
          ", "
        )}). Basic is per-employee and isn't a structure rule.`
      );
    }
    if (input.calculationType === "percent_of_gross") {
      throw new Error(
        "An allowance can't be % of gross (gross depends on it). Use a fixed amount or % of basic."
      );
    }
  }
}

/**
 * HRM_IlhaanSq standard salary "policy" — created idempotently. The structure
 * starts with no components; an empty structure keeps the legacy
 * per-employee behavior. Use seedStandardAllowanceRows to add editable
 * rules. (We no longer strip the allowance codes — they're meaningful now.)
 */
export async function ensureStandardSalaryStructure(tenantId: string) {
  const existing = await prisma.salaryStructure.findFirst({
    where: { tenantId, name: STRUCTURE_NAME },
    include: { components: true },
  });

  if (existing) {
    if (existing.description !== STRUCTURE_DESC) {
      await prisma.salaryStructure.update({
        where: { id: existing.id },
        data: { description: STRUCTURE_DESC },
      });
    }
    return prisma.salaryStructure.findFirst({
      where: { id: existing.id },
      include: { components: true },
    });
  }

  return prisma.salaryStructure.create({
    data: { tenantId, name: STRUCTURE_NAME, description: STRUCTURE_DESC },
    include: { components: true },
  });
}

// Create any of the 5 standard allowance rules that don't exist yet on the
// structure, as "% of basic = 0" so they're visible/editable in the table
// WITHOUT changing pay until the admin sets a value. Idempotent per code.
export async function seedStandardAllowanceRows(
  tenantId: string,
  structureId: string
) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { id: structureId, tenantId },
    include: { components: { select: { code: true, type: true } } },
  });
  if (!structure) throw new Error("Structure not found");

  const existingEarningCodes = new Set(
    structure.components
      .filter((c) => c.type === "earning")
      .map((c) => c.code)
  );
  const toCreate = ALLOWANCE_SLOTS.filter(
    (s) => !existingEarningCodes.has(s.code)
  );
  if (toCreate.length === 0) return { created: 0 };

  await prisma.salaryComponent.createMany({
    data: toCreate.map((s) => ({
      structureId,
      name: s.label,
      code: s.code,
      type: "earning" as const,
      calculationType: "percent_of_basic" as const,
      value: 0,
      sortOrder: s.sortOrder,
    })),
  });
  return { created: toCreate.length };
}

export async function addSalaryComponent(
  tenantId: string,
  input: {
    structureId: string;
    name: string;
    code: string;
    type: ComponentType;
    calculationType: ComponentCalc;
    value: number;
    taxable?: boolean;
    isStatutory?: boolean;
  }
) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { id: input.structureId, tenantId },
  });
  if (!structure) throw new Error("Structure not found");

  const code = input.code.toUpperCase();
  assertValidComponent({ ...input, code });

  // A component value (fixed amount or percentage) can never be negative — it
  // would produce a negative gross / confusing payslips.
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("Component value can't be negative.");
  }

  // One earning rule per allowance slot — a second would double-count.
  if (input.type === "earning") {
    const dup = await prisma.salaryComponent.findFirst({
      where: { structureId: input.structureId, type: "earning", code },
    });
    if (dup) {
      throw new Error(`A ${code} earning rule already exists on this structure.`);
    }
  }

  const last = await prisma.salaryComponent.findFirst({
    where: { structureId: input.structureId },
    orderBy: { sortOrder: "desc" },
  });

  return prisma.salaryComponent.create({
    data: {
      structureId: input.structureId,
      name: input.name,
      code,
      type: input.type,
      calculationType: input.calculationType,
      value: input.value,
      taxable: input.taxable ?? false,
      isStatutory: input.isStatutory ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });
}

// Edit an existing component (the editable table). Re-validates the merged
// result so e.g. flipping a deduction to an earning still obeys the slot
// rules. Tenant-scoped via the structure relation.
export async function updateSalaryComponent(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string;
    type?: ComponentType;
    calculationType?: ComponentCalc;
    value?: number;
  }
) {
  const c = await prisma.salaryComponent.findFirst({
    where: { id, structure: { tenantId } },
  });
  if (!c) throw new Error("Component not found");

  const merged = {
    type: (input.type ?? c.type) as ComponentType,
    code: (input.code ?? c.code).toUpperCase(),
    calculationType: (input.calculationType ??
      c.calculationType) as ComponentCalc,
  };
  assertValidComponent(merged);

  if (
    input.value !== undefined &&
    (!Number.isFinite(input.value) || input.value < 0)
  ) {
    throw new Error("Component value can't be negative.");
  }

  if (merged.type === "earning") {
    const dup = await prisma.salaryComponent.findFirst({
      where: {
        structureId: c.structureId,
        type: "earning",
        code: merged.code,
        id: { not: id },
      },
    });
    if (dup) {
      throw new Error(
        `A ${merged.code} earning rule already exists on this structure.`
      );
    }
  }

  return prisma.salaryComponent.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: merged.code } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.calculationType !== undefined
        ? { calculationType: input.calculationType }
        : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
    },
  });
}

export async function deleteSalaryComponent(tenantId: string, id: string) {
  const c = await prisma.salaryComponent.findFirst({
    where: { id, structure: { tenantId } },
  });
  if (!c) throw new Error("Component not found");
  await prisma.salaryComponent.delete({ where: { id } });
}

// ─── Employee Advances (ledger) ─────────────────────────────

export async function listAdvances(
  tenantId: string,
  filters: { status?: "active" | "cleared" | "cancelled" } = {}
) {
  const advances = await prisma.employeeAdvance.findMany({
    where: { tenantId, ...(filters.status && { status: filters.status }) },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
      _count: { select: { recoveries: true } },
    },
    orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
  });

  return advances.map((a) => ({
    ...a,
    amount: Number(a.amount),
    installment: Number(a.installment),
    outstanding: Number(a.outstanding),
    issuedAt: a.issuedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
}

export async function createAdvance(
  tenantId: string,
  input: {
    employeeId: string;
    amount: number;
    installment: number;
    reason?: string;
    issuedAt: Date;
    recoveryStart?: Date | null;
    recoveryEnd?: Date | null;
  },
  actor?: { userId: string; name: string }
) {
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  if (input.amount <= 0) throw new Error("Advance amount must be greater than 0");
  // Monthly recovery is optional at creation: 0 = no recovery scheduled yet
  // (nothing is pulled on payroll runs until an admin sets an installment via
  // updateAdvance). Only a negative value is invalid.
  if (input.installment < 0)
    throw new Error("Monthly recovery cannot be negative");
  // A half-specified window is silently ignored by the recovery logic (it only
  // applies when BOTH dates are set), which is a foot-gun — reject it loudly.
  if (Boolean(input.recoveryStart) !== Boolean(input.recoveryEnd))
    throw new Error(
      "Set both a recovery start and end month, or leave both empty."
    );
  if (
    input.recoveryStart &&
    input.recoveryEnd &&
    input.recoveryEnd < input.recoveryStart
  )
    throw new Error("Recovery end date must be on or after the start date");

  // Gated: created PENDING. Excluded from payroll recovery (which only pulls
  // status="active") until an owner/admin approves it in /admin.
  const advance = await prisma.employeeAdvance.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      amount: input.amount,
      installment: Math.max(0, input.installment),
      outstanding: input.amount,
      reason: input.reason,
      status: "pending",
      issuedAt: input.issuedAt,
      recoveryStart: input.recoveryStart ?? null,
      recoveryEnd: input.recoveryEnd ?? null,
    },
  });

  const emp = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { fullName: true, empCode: true },
  });
  await createApprovalRequest({
    tenantId,
    type: "employee_advance",
    entityType: "EmployeeAdvance",
    entityId: advance.id,
    title: emp ? `${emp.fullName} (${emp.empCode})` : "Employee advance",
    subtitle: `Advance ${input.amount.toLocaleString()}${input.reason ? ` · ${input.reason}` : ""}`,
    requestedBy: actor?.userId,
    requestedByName: actor?.name,
  });

  return advance;
}

export async function cancelAdvance(tenantId: string, id: string) {
  const adv = await prisma.employeeAdvance.findFirst({ where: { id, tenantId } });
  if (!adv) throw new Error("Advance not found");
  if (adv.status !== "active") throw new Error("Only active advances can be cancelled");
  return prisma.employeeAdvance.update({
    where: { id },
    data: { status: "cancelled" },
  });
}

/**
 * Edit an ACTIVE advance's amount / monthly installment / reason. This is the
 * fix for the "installment = 1 so nothing seems to recover" foot-gun: until
 * now an advance could only be cancelled, never corrected. `outstanding` is
 * recomputed as (newAmount − alreadyRecovered) and never goes negative; the
 * caller is expected to reconcile/refresh affected runs afterwards so the new
 * installment actually pulls through.
 */
export async function updateAdvance(
  tenantId: string,
  id: string,
  input: { amount?: number; installment?: number; reason?: string }
) {
  const adv = await prisma.employeeAdvance.findFirst({ where: { id, tenantId } });
  if (!adv) throw new Error("Advance not found");
  if (adv.status !== "active")
    throw new Error("Only active advances can be edited");

  const newAmount = input.amount ?? Number(adv.amount);
  const newInstallment = input.installment ?? Number(adv.installment);
  if (newAmount <= 0) throw new Error("Advance amount must be greater than 0");
  if (newInstallment <= 0) throw new Error("Installment must be greater than 0");

  const recovered = await prisma.advanceRecovery.aggregate({
    where: { advanceId: id },
    _sum: { amount: true },
  });
  const alreadyRecovered = Number(recovered._sum.amount ?? 0);
  const outstanding = round2(Math.max(0, newAmount - alreadyRecovered));

  return prisma.employeeAdvance.update({
    where: { id },
    data: {
      amount: newAmount,
      installment: newInstallment,
      outstanding,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(outstanding <= 0 ? { status: "cleared" as const } : {}),
    },
  });
}

/**
 * Re-sync the tenant's runs against the current advance ledger after an
 * advance is created / cancelled / edited, so the salary sheet's Advance
 * column updates automatically (the realtime layer then pings any open sheet
 * to re-fetch).
 *
 * runPayroll marks a run `completed` immediately (there is no resting
 * `pending` state), and "pending vs paid" salary is tracked PER PAYSLIP via
 * `paidAt`. So auto-sync covers all non-`failed` runs but passes
 * `skipPaid: true`: an unpaid payslip keeps absorbing new advances (the
 * "advance pending alongside month-end payment" window), while a payslip
 * already marked paid is frozen — its advance was settled with that payout.
 * The explicit "Refresh advances" button still does a full reconcile incl.
 * paid payslips (deliberate, unchanged). Returns the reconciled run ids.
 */
export async function reconcileRunAdvancesForTenant(
  tenantId: string
): Promise<string[]> {
  const runs = await prisma.payrollRun.findMany({
    where: { tenantId, status: { not: "failed" } },
    select: { id: true },
  });
  for (const r of runs) {
    await refreshRunAdvances(tenantId, r.id, { skipPaid: true });
  }
  return runs.map((r) => r.id);
}

/**
 * Re-sync a run's Advance Recovery with the current advance ledger
 * (Advances page). Idempotent: reverses this run's recoveries back into the
 * ledger, then re-applies recovery from the current ACTIVE advances exactly
 * like a fresh run would — so advances added/cancelled afterwards are
 * reflected, and running it repeatedly never double-deducts. Only the
 * advance figure + dependent totals change; earnings/absence are untouched.
 */
/**
 * Whether an advance should be recovered on a run with the given pay-period
 * start. If an explicit recovery window (recoveryStart..recoveryEnd) is set,
 * recover only when the run's month is within that window (inclusive). With no
 * window, fall back to the default rule: from the month AFTER it was issued
 * (never the same month). Pure UTC calendar-month comparison.
 */
function advanceRecoverableThisPeriod(
  adv: {
    issuedAt: Date;
    recoveryStart?: Date | null;
    recoveryEnd?: Date | null;
  },
  periodStart: Date
): boolean {
  const ym = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const pm = ym(periodStart);
  if (adv.recoveryStart && adv.recoveryEnd) {
    return pm >= ym(adv.recoveryStart) && pm <= ym(adv.recoveryEnd);
  }
  return pm > ym(adv.issuedAt);
}

export async function refreshRunAdvances(
  tenantId: string,
  runId: string,
  opts: { skipPaid?: boolean } = {}
) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, tenantId },
    select: { id: true, period: { select: { periodStart: true } } },
  });
  if (!run) throw new Error("Run not found.");
  const periodStart = run.period.periodStart;

  const payslips = await prisma.payslip.findMany({
    where: { runId, run: { tenantId } },
    select: {
      id: true,
      employeeId: true,
      totalSalary: true,
      lines: true,
      paidAt: true,
    },
    orderBy: { employeeId: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    // 1. Reverse every recovery this run made, back into the ledger.
    for (const p of payslips) {
      // Auto-sync leaves an already-paid payslip frozen: its advance was
      // settled with the salary payment, so don't reverse/re-pull it.
      if (opts.skipPaid && p.paidAt) continue;
      const recs = await tx.advanceRecovery.findMany({
        where: { payslipId: p.id },
      });
      for (const r of recs) {
        const adv = await tx.employeeAdvance.findUnique({
          where: { id: r.advanceId },
        });
        if (adv) {
          const restored = round2(
            Number(adv.outstanding) + Number(r.amount)
          );
          await tx.employeeAdvance.update({
            where: { id: adv.id },
            data: {
              outstanding: restored,
              ...(adv.status === "cleared" && restored > 0
                ? { status: "active" }
                : {}),
            },
          });
        }
      }
      await tx.advanceRecovery.deleteMany({ where: { payslipId: p.id } });
    }

    // 2. Re-apply from the restored ACTIVE ledger (same rule as runPayroll).
    for (const p of payslips) {
      if (opts.skipPaid && p.paidAt) continue; // frozen: settled when paid
      const advances = await tx.employeeAdvance.findMany({
        where: {
          tenantId,
          employeeId: p.employeeId,
          status: "active",
          outstanding: { gt: 0 },
        },
        orderBy: { issuedAt: "asc" },
      });
      let advanceRecovered = 0;
      for (const adv of advances) {
        // Recover only within the advance's window (or, by default, from the
        // month after it was issued).
        if (!advanceRecoverableThisPeriod(adv, periodStart)) continue;
        const outstanding = Number(adv.outstanding);
        const take = round2(Math.min(Number(adv.installment), outstanding));
        if (take <= 0) continue;
        advanceRecovered = round2(advanceRecovered + take);
        const newOut = round2(outstanding - take);
        await tx.advanceRecovery.create({
          data: { advanceId: adv.id, payslipId: p.id, amount: take },
        });
        await tx.employeeAdvance.update({
          where: { id: adv.id },
          data: {
            outstanding: newOut,
            ...(newOut <= 0 ? { status: "cleared" } : {}),
          },
        });
      }

      // 3. Recompute only the advance-dependent figures.
      const otherDeductions = round2(
        p.lines
          .filter(
            (l) =>
              l.type === "deduction" &&
              !["ABSENT", "ADVANCE"].includes(l.componentCode)
          )
          .reduce((s, l) => s + Number(l.amount), 0)
      );
      const absenceLine = p.lines.find((l) => l.componentCode === "ABSENT");
      const absenceDeduction = absenceLine ? Number(absenceLine.amount) : 0;
      const totalSalary = Number(p.totalSalary);
      const totalDed = round2(
        otherDeductions + absenceDeduction + advanceRecovered
      );
      const payableSalary = round2(totalSalary - totalDed);

      await tx.payslipLine.deleteMany({
        where: { payslipId: p.id, componentCode: "ADVANCE" },
      });
      if (advanceRecovered > 0) {
        await tx.payslipLine.create({
          data: {
            payslipId: p.id,
            componentName: "Advance Recovery",
            componentCode: "ADVANCE",
            amount: advanceRecovered,
            type: "deduction",
            sortOrder: 910,
          },
        });
      }
      await tx.payslip.update({
        where: { id: p.id },
        data: {
          advanceRecovered,
          totalDeductions: totalDed,
          netPay: payableSalary,
          payableSalary,
          amountPaid: payableSalary,
        },
      });
    }

    // 4. Recompute run totals from the updated payslips.
    const agg = await tx.payslip.aggregate({
      where: { runId },
      _sum: {
        totalEarnings: true,
        totalDeductions: true,
        payableSalary: true,
      },
    });
    await tx.payrollRun.update({
      where: { id: runId },
      data: {
        totalGross: round2(Number(agg._sum.totalEarnings ?? 0)),
        totalDeductions: round2(Number(agg._sum.totalDeductions ?? 0)),
        totalNet: round2(Number(agg._sum.payableSalary ?? 0)),
      },
    });
  });

  return { payslips: payslips.length };
}

/**
 * Salary-sheet → Advances write-back. The "Advance Recovery" cell and an
 * advance's "installment" are ONE value per employee, editable from either
 * page. When the admin edits Advance Recovery on the salary sheet, this sets
 * that amount as the `installment` on the employee's active advance(s), then
 * reconciles the run so Advance Recovery = min(installment, outstanding) and
 * the Advances page reflects the new installment. Idempotent. Returns how
 * many advances were updated (0 = employee has no active advance to bind to).
 */
export async function setEmployeeAdvanceInstallmentFromSheet(
  tenantId: string,
  payslipId: string,
  installment: number
): Promise<{ advancesUpdated: number }> {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, run: { tenantId } },
    select: { id: true, employeeId: true, runId: true },
  });
  if (!payslip) throw new Error("Payslip not found.");
  const value = Number.isFinite(installment) && installment > 0
    ? round2(installment)
    : 0;

  const res = await prisma.employeeAdvance.updateMany({
    where: { tenantId, employeeId: payslip.employeeId, status: "active" },
    data: { installment: value },
  });
  // Recompute Advance Recovery for this run from the new installment.
  await refreshRunAdvances(tenantId, payslip.runId, { skipPaid: true });
  return { advancesUpdated: res.count };
}

/** Stored Advance Recovery for a payslip (pre-edit change-detection). */
export async function getStoredAdvanceRecovered(
  tenantId: string,
  payslipId: string
): Promise<number | null> {
  const p = await prisma.payslip.findFirst({
    where: { id: payslipId, run: { tenantId } },
    select: { advanceRecovered: true },
  });
  return p ? Number(p.advanceRecovered) : null;
}

// One employee's payslips across every month/run — for the employee portal.
export async function listPayslipsForEmployee(
  tenantId: string,
  employeeId: string
) {
  const slips = await prisma.payslip.findMany({
    where: { employeeId, run: { tenantId } },
    include: { run: { include: { period: true } } },
    orderBy: { generatedAt: "desc" },
    take: 60,
  });
  return slips.map((s) => {
    const period = s.run.period;
    const label =
      period?.name ||
      (period
        ? new Date(period.periodStart).toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })
        : new Date(s.generatedAt).toLocaleDateString());
    return {
      id: s.id,
      runId: s.runId,
      month: label,
      periodStart: period ? new Date(period.periodStart).toISOString() : null,
      periodEnd: period ? new Date(period.periodEnd).toISOString() : null,
      payDate: period ? new Date(period.payDate).toISOString() : null,
      basic: Number(s.basicSalary),
      gross: Number(s.totalEarnings),
      deductions: Number(s.totalDeductions),
      extraDutyDays: Number(s.extraDutyDays),
      extraDutyPayment: Number(s.extraDutyPayment),
      absentDays: Number(s.absentDays),
      netPay: Number(s.netPay),
      payable: Number(s.payableSalary),
      amountPaid: Number(s.amountPaid),
      currency: s.currency,
      paidAt: s.paidAt ? s.paidAt.toISOString() : null,
      generatedAt: s.generatedAt.toISOString(),
    };
  });
}

// ─── Payroll Periods + Runs ─────────────────────────────────

export async function listPayrollRuns(tenantId: string) {
  return prisma.payrollRun.findMany({
    where: { tenantId },
    include: {
      period: true,
      _count: { select: { payslips: true } },
    },
    orderBy: { runAt: "desc" },
  });
}

export async function getPayrollRun(tenantId: string, id: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id, tenantId },
    include: {
      period: true,
      payslips: {
        include: { lines: { orderBy: { sortOrder: "asc" } } },
        orderBy: { generatedAt: "asc" },
      },
    },
  });
  if (!run) return null;

  // Payslip has no Employee relation (kept denormalized) — resolve names/codes.
  const employeeIds = run.payslips.map((p) => p.employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, tenantId },
    select: {
      id: true,
      fullName: true,
      empCode: true,
      position: { select: { title: true } },
    },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  return {
    ...run,
    payslips: run.payslips.map((p) => {
      const e = empMap.get(p.employeeId);
      return {
        ...p,
        employeeName: e?.fullName ?? "(removed)",
        employeeCode: e?.empCode ?? "—",
        designation: e?.position?.title ?? "—",
      };
    }),
  };
}

/**
 * Active employees that will be included in a payroll run, with their salary
 * breakdown + absent-day counts from attendance — used to prefill the
 * run-payroll adjustments table.
 */
export async function getPayrollPrep(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const salaries = await prisma.employeeSalary.findMany({
    where: {
      employee: { tenantId, status: "active" },
      effectiveFrom: { lte: periodStart },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
    },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          empCode: true,
          position: { select: { title: true } },
        },
      },
      structure: { include: { components: { orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { employee: { empCode: "asc" } },
  });

  // Batched lookups — one query each across all employees instead of three
  // queries per employee (avoids the N+1 pattern on large headcounts).
  const employeeIds = salaries.map((s) => s.employeeId);
  const [absentGroups, lateAbsenceMap, advanceGroups] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["employeeId"],
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        status: "absent",
        date: { gte: periodStart, lte: periodEnd },
      },
      _count: { _all: true },
    }),
    countLateToAbsenceBatch(tenantId, employeeIds, periodStart, periodEnd),
    prisma.employeeAdvance.groupBy({
      by: ["employeeId"],
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        status: "active",
        outstanding: { gt: 0 },
      },
      _sum: { outstanding: true },
    }),
  ]);
  const absentMap = new Map(
    absentGroups.map((g) => [g.employeeId, g._count._all])
  );
  const advanceMap = new Map(
    advanceGroups.map((g) => [g.employeeId, Number(g._sum.outstanding ?? 0)])
  );

  return salaries.map((s) => {
    const totalAbsentDays =
      (absentMap.get(s.employeeId) ?? 0) +
      (lateAbsenceMap.get(s.employeeId) ?? 0);
    const basic = Number(s.baseSalary);
    // Mirror runPayroll: structure rules drive allowances when defined,
    // else the employee's own amounts — so the prep table preview matches
    // what the run will actually compute.
    const a = resolveAllowances(s.structure.components, basic, {
      houseRent: Number(s.houseRent),
      health: Number(s.health),
      education: Number(s.education),
      savings: Number(s.savings),
      dailyHand: Number(s.dailyHand),
    });
    const gross = round2(
      basic + a.houseRent + a.health + a.education + a.savings + a.dailyHand
    );
    return {
      employeeId: s.employeeId,
      empCode: s.employee.empCode,
      name: s.employee.fullName,
      designation: s.employee.position?.title ?? "—",
      baseSalary: basic,
      grossSalary: gross,
      absentDays: totalAbsentDays,
      outstandingAdvance: advanceMap.get(s.employeeId) ?? 0,
    };
  });
}

// ─── Run Payroll ────────────────────────────────────────────

export async function runPayroll(
  tenantId: string,
  input: {
    name: string;
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    runBy?: string;
    /**
     * Per-employee payroll adjustments. Absent days default from attendance and
     * the deduction defaults to (Basic ÷ 30) × days. If the admin changes the
     * days or the deduction amount, a `reason` is required. `extraDutyDays`
     * adds Extra Duty Payment = (Basic ÷ 30) × days.
     */
    adjustments?: Record<
      string,
      {
        absentDays?: number;
        deduction?: number;
        reason?: string;
        extraDutyDays?: number;
      }
    >;
  }
) {
  // One payroll period per tenant per start date (DB enforces
  // @@unique([tenantId, periodStart])). Pre-check for a clear message; the
  // try/catch below is the race-condition safety net.
  const startYmd = input.periodStart.toISOString().slice(0, 10);
  const existing = await prisma.payrollPeriod.findUnique({
    where: {
      tenantId_periodStart: { tenantId, periodStart: input.periodStart },
    },
    select: { name: true },
  });
  if (existing) {
    // Expected validation failure — return it (don't throw) so the Server
    // Action surfaces the message to the user instead of a 500 + redacted
    // error in production.
    return {
      ok: false as const,
      error: `Payroll for "${existing.name}" (period starting ${startYmd}) has already been run. Delete that run first, or choose a different start date.`,
    };
  }

  let period: PayrollPeriod;
  try {
    period = await prisma.payrollPeriod.create({
      data: {
        tenantId,
        name: input.name,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        payDate: input.payDate,
        status: "processing",
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return {
        ok: false as const,
        error: `Payroll for the period starting ${startYmd} has already been run. Delete that run first, or choose a different start date.`,
      };
    }
    throw e;
  }

  const run = await prisma.payrollRun.create({
    data: {
      tenantId,
      periodId: period.id,
      status: "processing",
      runBy: input.runBy,
    },
  });

  const salaries = await prisma.employeeSalary.findMany({
    where: {
      employee: { tenantId, status: "active" },
      effectiveFrom: { lte: input.periodStart },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.periodEnd } }],
    },
    include: {
      employee: { select: { id: true, fullName: true } },
      structure: { include: { components: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const sal of salaries) {
    const basic = Number(sal.baseSalary);
    // Allowances: structure earning rules drive these when defined,
    // otherwise the employee's own stored amounts (see resolveAllowances).
    const { houseRent, health, education, savings, dailyHand } =
      resolveAllowances(sal.structure.components, basic, {
        houseRent: Number(sal.houseRent),
        health: Number(sal.health),
        education: Number(sal.education),
        savings: Number(sal.savings),
        dailyHand: Number(sal.dailyHand),
      });
    const gross = round2(basic + houseRent + health + education + savings + dailyHand);

    const lines: Array<{
      componentName: string;
      componentCode: string;
      amount: number;
      type: "earning" | "deduction" | "reimbursement";
      sortOrder: number;
    }> = [
      { componentName: "Basic Salary", componentCode: "BASIC", amount: round2(basic), type: "earning", sortOrder: 0 },
    ];
    const addEarning = (name: string, code: string, amount: number, sortOrder: number) => {
      if (amount > 0) lines.push({ componentName: name, componentCode: code, amount: round2(amount), type: "earning", sortOrder });
    };
    addEarning("House Rent", "HRENT", houseRent, 10);
    addEarning("Health Allowance", "HEALTH", health, 20);
    addEarning("Education Allowance", "EDU", education, 30);
    addEarning("Savings", "SAV", savings, 40);
    addEarning("Daily Hand Expenses", "DHEXP", dailyHand, 50);

    // Extra duty = manual per-run adjustment PLUS every Friday (weekly
    // holiday) the employee actually worked in this period. Paid Basic/30
    // per extra day.
    const workedRows = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: sal.employeeId,
        checkIn: { not: null },
        date: { gte: input.periodStart, lte: input.periodEnd },
      },
      select: { date: true },
    });
    const fridayWorkedDays = workedRows.filter((r) =>
      isWeeklyHoliday(r.date)
    ).length;
    const manualExtraDuty =
      input.adjustments?.[sal.employeeId]?.extraDutyDays ?? 0;
    const extraDutyDays = manualExtraDuty + fridayWorkedDays;
    const extraDutyPayment = round2((basic / 30) * extraDutyDays);
    if (extraDutyPayment > 0) {
      lines.push({
        componentName: `Extra Duty Payment (${extraDutyDays} day${extraDutyDays === 1 ? "" : "s"})`,
        componentCode: "EXTRADUTY",
        amount: extraDutyPayment,
        type: "earning",
        sortOrder: 60,
      });
    }

    const totalSalary = round2(gross + extraDutyPayment);

    // Optional custom structure deductions (e.g. tax/PF). Standard = none.
    let otherDeductions = 0;
    for (const comp of sal.structure.components.filter((c) => c.type === "deduction")) {
      const v = Number(comp.value);
      let amount = 0;
      if (comp.calculationType === "fixed") amount = v;
      else if (comp.calculationType === "percent_of_basic") amount = (basic * v) / 100;
      else if (comp.calculationType === "percent_of_gross") amount = (gross * v) / 100;
      amount = round2(amount);
      lines.push({ componentName: comp.name, componentCode: comp.code, amount, type: "deduction", sortOrder: comp.sortOrder });
      otherDeductions += amount;
    }

    // Absence deduction. Defaults: days from attendance + late conversion, amount = Basic/30 × days.
    // Admin may override either; if so a reason is mandatory.
    const [absentRows, lateDetail] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: sal.employeeId,
          status: "absent",
          date: { gte: input.periodStart, lte: input.periodEnd },
        },
        select: { date: true },
      }),
      getLateToAbsenceDetail(
        tenantId,
        sal.employeeId,
        input.periodStart,
        input.periodEnd
      ),
    ]);
    // Friday (weekly holiday) is never counted as an absent working day.
    const attendanceDays = absentRows.filter(
      (r) => !isWeeklyHoliday(r.date)
    ).length;
    // Late → absence: per month, every 3 lates = 1 absent day.
    const lateAbsenceDays = lateDetail.absenceDays;
    const adj = input.adjustments?.[sal.employeeId];
    const absentDays = adj?.absentDays ?? (attendanceDays + lateAbsenceDays);
    const formulaDeduction = round2((basic / 30) * absentDays);
    const absenceDeduction =
      adj?.deduction !== undefined ? round2(adj.deduction) : formulaDeduction;
    const reason = adj?.reason?.trim() || null;

    const computedTotal = attendanceDays + lateAbsenceDays;
    const daysChanged = absentDays !== computedTotal;
    const amountChanged = absenceDeduction !== formulaDeduction;
    if ((daysChanged || amountChanged) && !reason) {
      throw new Error(
        `A reason is required for the adjusted absence of ${sal.employee.fullName}.`
      );
    }
    const absenceReason = daysChanged || amountChanged ? reason : null;

    if (absenceDeduction > 0) {
      // Spell out the rule on the payslip so the employee sees how the
      // deduction was derived.
      const lateNote =
        lateAbsenceDays > 0
          ? ` incl. ${lateAbsenceDays} from late rule (${lateDetail.lateDays} late ÷ 3 per month)`
          : "";
      const autoName =
        `Absence Deduction (${absentDays} day${absentDays === 1 ? "" : "s"}` +
        `: ${attendanceDays} absent${lateNote}) — Basic/30 each`;
      lines.push({
        componentName: absenceReason
          ? `Absence Deduction (${absentDays} day${absentDays === 1 ? "" : "s"}) — ${absenceReason}`
          : autoName,
        componentCode: "ABSENT",
        amount: absenceDeduction,
        type: "deduction",
        sortOrder: 900,
      });
    }

    // Advance recovery from the ledger (oldest first)
    const advances = await prisma.employeeAdvance.findMany({
      where: { tenantId, employeeId: sal.employeeId, status: "active", outstanding: { gt: 0 } },
      orderBy: { issuedAt: "asc" },
    });
    let advanceRecovered = 0;
    const recoveryPlan: Array<{ advanceId: string; amount: number; newOutstanding: number }> = [];
    for (const adv of advances) {
      if (!advanceRecoverableThisPeriod(adv, input.periodStart)) continue;
      const outstanding = Number(adv.outstanding);
      const take = round2(Math.min(Number(adv.installment), outstanding));
      if (take <= 0) continue;
      advanceRecovered = round2(advanceRecovered + take);
      recoveryPlan.push({ advanceId: adv.id, amount: take, newOutstanding: round2(outstanding - take) });
    }
    if (advanceRecovered > 0) {
      lines.push({
        componentName: "Advance Recovery",
        componentCode: "ADVANCE",
        amount: advanceRecovered,
        type: "deduction",
        sortOrder: 910,
      });
    }

    // Break time penalty deduction
    const pendingPenalties = await prisma.breakPenalty.findMany({
      where: { tenantId, employeeId: sal.employeeId, status: "pending", payslipId: null },
      orderBy: { createdAt: "asc" },
    });
    let breakPenalty = 0;
    const appliedPenaltyIds: string[] = [];
    for (const p of pendingPenalties) {
      breakPenalty = round2(breakPenalty + Number(p.amount));
      appliedPenaltyIds.push(p.id);
    }
    if (breakPenalty > 0) {
      lines.push({
        componentName: `Break Time Penalty (${pendingPenalties.length} incident${pendingPenalties.length === 1 ? "" : "s"})`,
        componentCode: "BREAK",
        amount: breakPenalty,
        type: "deduction",
        sortOrder: 920,
      });
    }

    const totalDed = round2(otherDeductions + absenceDeduction + advanceRecovered + breakPenalty);
    const payableSalary = round2(totalSalary - totalDed);

    totalGross += gross;
    totalDeductions += totalDed;
    totalNet += payableSalary;

    await prisma.$transaction(async (tx) => {
      const payslip = await tx.payslip.create({
        data: {
          runId: run.id,
          employeeId: sal.employeeId,
          basicSalary: basic,
          totalEarnings: gross,
          totalDeductions: totalDed,
          netPay: payableSalary,
          houseRent,
          health,
          education,
          savings,
          dailyHand,
          extraDutyDays,
          extraDutyPayment,
          totalSalary,
          absentDays,
          absenceDeduction,
          absenceReason,
          advanceRecovered,
          breakPenalty,
          reimbursements: 0,
          payableSalary,
          amountPaid: payableSalary,
          currency: sal.currency,
          lines: { create: lines },
        },
      });

      for (const r of recoveryPlan) {
        await tx.advanceRecovery.create({
          data: { advanceId: r.advanceId, payslipId: payslip.id, amount: r.amount },
        });
        await tx.employeeAdvance.update({
          where: { id: r.advanceId },
          data: {
            outstanding: r.newOutstanding,
            ...(r.newOutstanding <= 0 && { status: "cleared" }),
          },
        });
      }

      for (const pid of appliedPenaltyIds) {
        await tx.breakPenalty.update({
          where: { id: pid },
          data: {
            status: "applied",
            appliedAt: new Date(),
            appliedBy: "system",
            payslipId: payslip.id,
          },
        });
      }
    });
  }

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      totalGross: round2(totalGross),
      totalDeductions: round2(totalDeductions),
      totalNet: round2(totalNet),
      employeeCount: salaries.length,
      completedAt: new Date(),
    },
  });

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: "locked" },
  });

  return { ok: true as const, run, period, payslipCount: salaries.length };
}

/**
 * Effective tenant role resolved live from the DB membership — avoids the
 * stale-JWT problem where session.role is only set at login.
 */
export async function getEffectiveTenantRole(
  tenantId: string,
  userId: string
): Promise<string | null> {
  const m = await prisma.tenantMember.findFirst({
    where: { tenantId, userId },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function isTenantAdmin(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const role = await getEffectiveTenantRole(tenantId, userId);
  return role === "owner" || role === "admin";
}

// ─── Edit a payslip on the salary sheet (admin) ─────────────
// Edits the raw inputs; gross / total salary / payable are recomputed with
// the same formulas as a run. The advance ledger is intentionally NOT touched
// — only this payslip's advance figure changes.

export async function updatePayslip(
  tenantId: string,
  payslipId: string,
  input: {
    basic: number;
    houseRent: number;
    health: number;
    education: number;
    savings: number;
    dailyHand: number;
    extraDutyDays: number;
    absentDays: number;
    advanceRecovered: number;
    absenceReason?: string;
  }
) {
  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, run: { tenantId } },
    include: { lines: true, run: true },
  });
  if (!payslip) throw new Error("Payslip not found");

  const nn = (n: number) => (Number.isFinite(n) && n >= 0 ? round2(n) : 0);
  const basic = nn(input.basic);
  const houseRent = nn(input.houseRent);
  const health = nn(input.health);
  const education = nn(input.education);
  const savings = nn(input.savings);
  const dailyHand = nn(input.dailyHand);
  const extraDutyDays = nn(input.extraDutyDays);
  const absentDays = nn(input.absentDays);
  const advanceRecovered = nn(input.advanceRecovered);

  const gross = round2(basic + houseRent + health + education + savings + dailyHand);
  const extraDutyPayment = round2((basic / 30) * extraDutyDays);
  const totalSalary = round2(gross + extraDutyPayment);
  const absenceDeduction = round2((basic / 30) * absentDays);
  const absenceReason = input.absenceReason?.trim() || null;

  // Preserve any custom structure deduction lines (not absence/advance).
  const customDeductions = payslip.lines.filter(
    (l) => l.type === "deduction" && !["ABSENT", "ADVANCE"].includes(l.componentCode)
  );
  const otherDeductions = round2(
    customDeductions.reduce((s, l) => s + Number(l.amount), 0)
  );

  const totalDed = round2(otherDeductions + absenceDeduction + advanceRecovered);
  const payableSalary = round2(totalSalary - totalDed);

  const lines: Array<{
    componentName: string;
    componentCode: string;
    amount: number;
    type: "earning" | "deduction" | "reimbursement";
    sortOrder: number;
  }> = [
    { componentName: "Basic Salary", componentCode: "BASIC", amount: basic, type: "earning", sortOrder: 0 },
  ];
  const addEarning = (name: string, code: string, amount: number, sortOrder: number) => {
    if (amount > 0) lines.push({ componentName: name, componentCode: code, amount, type: "earning", sortOrder });
  };
  addEarning("House Rent", "HRENT", houseRent, 10);
  addEarning("Health Allowance", "HEALTH", health, 20);
  addEarning("Education Allowance", "EDU", education, 30);
  addEarning("Savings", "SAV", savings, 40);
  addEarning("Daily Hand Expenses", "DHEXP", dailyHand, 50);
  if (extraDutyPayment > 0) {
    lines.push({
      componentName: `Extra Duty Payment (${extraDutyDays} day${extraDutyDays === 1 ? "" : "s"})`,
      componentCode: "EXTRADUTY",
      amount: extraDutyPayment,
      type: "earning",
      sortOrder: 60,
    });
  }
  for (const l of customDeductions) {
    lines.push({
      componentName: l.componentName,
      componentCode: l.componentCode,
      amount: round2(Number(l.amount)),
      type: "deduction",
      sortOrder: l.sortOrder,
    });
  }
  if (absenceDeduction > 0) {
    lines.push({
      componentName:
        `Absence Deduction (${absentDays} day${absentDays === 1 ? "" : "s"})` +
        (absenceReason ? ` — ${absenceReason}` : ""),
      componentCode: "ABSENT",
      amount: absenceDeduction,
      type: "deduction",
      sortOrder: 900,
    });
  }
  if (advanceRecovered > 0) {
    lines.push({
      componentName: "Advance Recovery",
      componentCode: "ADVANCE",
      amount: advanceRecovered,
      type: "deduction",
      sortOrder: 910,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payslipLine.deleteMany({ where: { payslipId } });
    await tx.payslip.update({
      where: { id: payslipId },
      data: {
        basicSalary: basic,
        totalEarnings: gross,
        totalDeductions: totalDed,
        netPay: payableSalary,
        houseRent,
        health,
        education,
        savings,
        dailyHand,
        extraDutyDays,
        extraDutyPayment,
        totalSalary,
        absentDays,
        absenceDeduction,
        absenceReason,
        advanceRecovered,
        payableSalary,
        amountPaid: payableSalary,
        lines: { create: lines },
      },
    });

    // Recompute the run-level totals from all its payslips.
    const agg = await tx.payslip.aggregate({
      where: { runId: payslip.runId },
      _sum: { totalEarnings: true, totalDeductions: true, payableSalary: true },
    });
    await tx.payrollRun.update({
      where: { id: payslip.runId },
      data: {
        totalGross: round2(Number(agg._sum.totalEarnings ?? 0)),
        totalDeductions: round2(Number(agg._sum.totalDeductions ?? 0)),
        totalNet: round2(Number(agg._sum.payableSalary ?? 0)),
      },
    });
  });

  return { ok: true };
}

// ─── Employee Salary Assignment ─────────────────────────────

export async function assignSalary(
  tenantId: string,
  input: {
    employeeId: string;
    structureId: string;
    baseSalary: number;
    houseRent?: number;
    health?: number;
    education?: number;
    savings?: number;
    dailyHand?: number;
    currency?: string;
    effectiveFrom: Date;
  }
) {
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "salaryStructure", [input.structureId]);

  await prisma.employeeSalary.updateMany({
    where: { employeeId: input.employeeId, effectiveTo: null },
    data: { effectiveTo: input.effectiveFrom },
  });

  return prisma.employeeSalary.create({
    data: {
      employeeId: input.employeeId,
      structureId: input.structureId,
      baseSalary: input.baseSalary,
      houseRent: input.houseRent ?? 0,
      health: input.health ?? 0,
      education: input.education ?? 0,
      savings: input.savings ?? 0,
      dailyHand: input.dailyHand ?? 0,
      currency: input.currency ?? "BDT",
      effectiveFrom: input.effectiveFrom,
    },
  });
}

export async function getPayrollStats(tenantId: string) {
  const [structureCount, runCount, activeSalaryCount, activeAdvanceCount, lastRun] =
    await Promise.all([
      prisma.salaryStructure.count({ where: { tenantId, isActive: true } }),
      prisma.payrollRun.count({ where: { tenantId } }),
      prisma.employeeSalary.count({
        where: { employee: { tenantId, status: "active" }, effectiveTo: null },
      }),
      prisma.employeeAdvance.count({ where: { tenantId, status: "active" } }),
      prisma.payrollRun.findFirst({
        where: { tenantId, status: "completed" },
        orderBy: { completedAt: "desc" },
        include: { period: true },
      }),
    ]);

  return { structureCount, runCount, activeSalaryCount, activeAdvanceCount, lastRun };
}

// ─── Custom Salary-Sheet Columns ────────────────────────────
// Admin-defined derived columns. Each is computed from a base payslip field
// via an operation against another field or a constant. Display-only for now
// (does NOT change Net Payable — `affectsTotal` is reserved for later).

/** Base payslip fields a custom column can reference (key → display label). */
export const PAYROLL_BASE_FIELDS = [
  { key: "basicSalary", label: "Basic" },
  { key: "houseRent", label: "House Rent" },
  { key: "health", label: "Health" },
  { key: "education", label: "Education" },
  { key: "savings", label: "Savings" },
  { key: "dailyHand", label: "Daily Hand Expenses" },
  { key: "totalEarnings", label: "Gross Salary" },
  { key: "extraDutyDays", label: "Extra Duty Days" },
  { key: "extraDutyPayment", label: "Extra Duty Pay" },
  { key: "totalSalary", label: "Total Salary" },
  { key: "advanceRecovered", label: "Advance Recovery" },
  { key: "breakPenalty", label: "Break Penalty" },
  { key: "absentDays", label: "Absent Days" },
  { key: "absenceDeduction", label: "Absence Deduction" },
  { key: "payableSalary", label: "Net Payable" },
] as const;

export type PayrollBaseFieldKey = (typeof PAYROLL_BASE_FIELDS)[number]["key"];

const FIELD_KEYS = PAYROLL_BASE_FIELDS.map((f) => f.key) as string[];
const FIELD_LABEL = new Map(
  PAYROLL_BASE_FIELDS.map((f) => [f.key as string, f.label])
);

export type FormulaOperand =
  | { kind: "field"; field: string }
  | { kind: "const"; value: number };
// A formula is an ordered chain of steps evaluated left-to-right:
//   value = step0;  for each next step:  value = value <step.op> step
// (step0.op is the seed and is ignored when evaluating).
export type FormulaRow = FormulaOperand & {
  op: "multiply" | "add" | "subtract" | "divide";
};

export type PayrollColumnInput = {
  name: string;
  shortLabel: string;
  group: "earning" | "deduction";
  /** Ordered step chain (see FormulaRow). Ignored when `manual` is true. */
  formula: FormulaRow[];
  /** Manual = admin types a value per employee on the sheet (no formula). */
  manual?: boolean;
};

const OPS = ["multiply", "add", "subtract", "divide"] as const;

function applyOp(a: number, op: string, b: number): number {
  if (op === "multiply") return a * b;
  if (op === "add") return a + b;
  if (op === "divide") return b === 0 ? 0 : a / b;
  return a - b; // subtract
}

function opSymbol(op: string): string {
  return op === "multiply"
    ? "×"
    : op === "add"
    ? "+"
    : op === "divide"
    ? "÷"
    : "−";
}

function operandNumber(o: FormulaOperand, values: Record<string, number>) {
  return o.kind === "const"
    ? Number(o.value ?? 0)
    : Number(values[o.field] ?? 0);
}

function operandLabel(
  o: FormulaOperand,
  names?: Record<string, string>
): string {
  return o.kind === "const"
    ? String(o.value)
    : FIELD_LABEL.get(o.field) ?? names?.[o.field] ?? o.field;
}

/** Parse the stored formula JSON into a typed step chain (tolerant). */
export function parseFormula(raw: unknown): FormulaRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FormulaRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const op = (OPS as readonly string[]).includes(String(r.op))
      ? (String(r.op) as FormulaRow["op"])
      : "add";
    if (r.kind === "const") {
      const v = Number(r.value);
      if (Number.isFinite(v)) out.push({ kind: "const", value: v, op });
    } else if (r.kind === "field" && typeof r.field === "string") {
      out.push({ kind: "field", field: r.field, op });
    }
  }
  return out;
}

type ColumnDef = {
  operation: string;
  sourceField: string;
  operandKind: string;
  operandField: string | null;
  operandValue: { toString(): string } | number | null;
  formula?: unknown;
};

/** Evaluate the step chain left-to-right; legacy single-op fallback. */
export function computeCustomColumnValue(
  def: ColumnDef,
  values: Record<string, number>
): number {
  const steps = parseFormula(def.formula);
  let r = 0;
  // A stored formula array (even empty) uses the step chain — an empty
  // formula is a valid "no logic yet" column worth 0. Only true legacy
  // rows (formula null/undefined) use the single-op fallback.
  if (Array.isArray(def.formula)) {
    if (steps.length === 0) return 0;
    r = operandNumber(steps[0], values);
    for (let i = 1; i < steps.length; i++)
      r = applyOp(r, steps[i].op, operandNumber(steps[i], values));
  } else if (steps.length > 0) {
    r = operandNumber(steps[0], values);
    for (let i = 1; i < steps.length; i++)
      r = applyOp(r, steps[i].op, operandNumber(steps[i], values));
  } else {
    const a = Number(values[def.sourceField] ?? 0);
    const b =
      def.operandKind === "constant"
        ? Number(def.operandValue ?? 0)
        : Number(values[def.operandField ?? ""] ?? 0);
    r = applyOp(a, def.operation, b);
  }
  return Math.round((r + Number.EPSILON) * 100) / 100;
}

/**
 * Single source of truth for "is this custom column typed per-employee
 * (editable in row-edit mode) vs formula-computed (read-only)".
 *
 * MANUAL when it's flagged `manual` OR it simply has no formula — a blank
 * column worth 0 until logic is added. Only a column with real formula steps
 * is computed. This is symmetric for earnings AND deductions and immune to a
 * stale/false `manual` flag on older rows, so every blank new column in either
 * group is editable by default. Legacy rows (formula not an array) keep their
 * single-op computation and stay read-only.
 */
export function isManualColumn(def: {
  manual?: boolean | null;
  formula?: unknown;
}): boolean {
  if (def.manual) return true;
  return (
    Array.isArray(def.formula) &&
    parseFormula(def.formula as FormulaRow[]).length === 0
  );
}

/** Human-readable formula, e.g. `Basic + House Rent − Advance`. */
export function describeCustomColumn(
  def: ColumnDef,
  names?: Record<string, string>
): string {
  const steps = parseFormula(def.formula);
  if (steps.length > 0)
    return steps
      .map((s, i) =>
        i === 0
          ? operandLabel(s, names)
          : `${opSymbol(s.op)} ${operandLabel(s, names)}`
      )
      .join(" ");
  if (Array.isArray(def.formula)) return "—"; // saved with no formula
  const a =
    FIELD_LABEL.get(def.sourceField) ??
    names?.[def.sourceField] ??
    def.sourceField;
  const b =
    def.operandKind === "constant"
      ? String(Number(def.operandValue ?? 0))
      : FIELD_LABEL.get(def.operandField ?? "") ??
        names?.[def.operandField ?? ""] ??
        def.operandField ??
        "?";
  return `${a} ${opSymbol(def.operation)} ${b}`;
}

function validateColumnInput(input: PayrollColumnInput) {
  const name = input.name?.trim();
  const shortLabel = input.shortLabel?.trim();
  if (!name) throw new Error("Name is required.");
  if (!shortLabel) throw new Error("Label is required.");
  if (!["earning", "deduction"].includes(input.group))
    throw new Error("Group must be Earnings or Deductions.");
  // An empty formula is allowed — the column saves as a shell (value 0)
  // and logic can be added later. Only validate entries that exist.
  const formula = Array.isArray(input.formula) ? input.formula : [];
  for (const s of formula) {
    if (!(OPS as readonly string[]).includes(s.op))
      throw new Error("Operation must be ×, +, − or ÷.");
    if (s.kind === "field") {
      // A base field key OR another custom column's id (UUID).
      const isCustomRef = /^[0-9a-fA-F-]{36}$/.test(s.field);
      if (!FIELD_KEYS.includes(s.field) && !isCustomRef)
        throw new Error("Pick a valid column.");
    } else if (s.kind === "const") {
      if (!Number.isFinite(s.value))
        throw new Error("Enter a valid number.");
    } else {
      throw new Error("Invalid value.");
    }
  }
  return { name, shortLabel };
}

// Legacy NOT NULL columns kept in sync from the chain; `formula` is
// authoritative for computation/display.
function legacyFromFormula(steps: FormulaRow[]) {
  const first = steps[0];
  const second = steps[1];
  const srcStep = steps.find((s) => s.kind === "field");
  return {
    operation: second?.op ?? first?.op ?? "add",
    sourceField:
      srcStep && srcStep.kind === "field" ? srcStep.field : "basicSalary",
    operandKind: (second?.kind === "const" ? "constant" : "field") as
      | "constant"
      | "field",
    operandField:
      second && second.kind === "field" ? second.field : null,
    operandValue:
      second && second.kind === "const" ? second.value : null,
  };
}

export function listPayrollColumns(tenantId: string) {
  return prisma.payrollCustomColumn.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createPayrollColumn(
  tenantId: string,
  input: PayrollColumnInput
) {
  const { name, shortLabel } = validateColumnInput(input);
  const count = await prisma.payrollCustomColumn.count({ where: { tenantId } });
  const legacy = legacyFromFormula(input.formula);
  try {
    return await prisma.payrollCustomColumn.create({
      data: {
        tenantId,
        name,
        shortLabel,
        group: input.group,
        manual: !!input.manual,
        ...legacy,
        formula: input.formula as unknown as Prisma.InputJsonValue,
        sortOrder: count,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      throw new Error(`A column named "${name}" already exists.`);
    throw e;
  }
}

export async function updatePayrollColumn(
  tenantId: string,
  id: string,
  input: PayrollColumnInput
) {
  const { name, shortLabel } = validateColumnInput(input);
  const legacy = legacyFromFormula(input.formula);
  try {
    const res = await prisma.payrollCustomColumn.updateMany({
      where: { id, tenantId },
      data: {
        name,
        shortLabel,
        group: input.group,
        manual: !!input.manual,
        ...legacy,
        formula: input.formula as unknown as Prisma.InputJsonValue,
      },
    });
    if (res.count === 0) throw new Error("Column not found.");
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002")
      throw new Error(`A column named "${name}" already exists.`);
    throw e;
  }
}

export async function deletePayrollColumn(tenantId: string, id: string) {
  const res = await prisma.payrollCustomColumn.deleteMany({
    where: { id, tenantId },
  });
  if (res.count === 0) throw new Error("Column not found.");
}

/** Mark / unmark a single payslip as salary-paid (tenant-scoped). */
export async function setPayslipPaid(
  tenantId: string,
  payslipId: string,
  paid: boolean,
  userId: string
) {
  const res = await prisma.payslip.updateMany({
    where: { id: payslipId, run: { tenantId } },
    data: paid
      ? { paidAt: new Date(), paidBy: userId }
      : { paidAt: null, paidBy: null },
  });
  if (res.count === 0) throw new Error("Payslip not found.");
}

// ─── Manual per-employee custom-column values ───────────────────────────
// Display-only: summed into the sheet's Total/Net like computed custom
// columns; stored payslip totals are never modified.

/** All manual values for a run's payslips → `${payslipId}:${columnId}` map. */
export async function getPayslipCustomValues(
  tenantId: string,
  runId: string
): Promise<Record<string, number>> {
  const rows = await prisma.payslipCustomValue.findMany({
    where: {
      column: { tenantId },
      payslip: { runId, run: { tenantId } },
    },
    select: { payslipId: true, columnId: true, value: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[`${r.payslipId}:${r.columnId}`] = Number(r.value);
  return out;
}

/** Set/clear one employee's manual value for a manual custom column. */
export async function setPayslipCustomValue(
  tenantId: string,
  payslipId: string,
  columnId: string,
  value: number
) {
  const col = await prisma.payrollCustomColumn.findFirst({
    where: { id: columnId, tenantId },
    select: { manual: true, formula: true },
  });
  if (!col) throw new Error("Column not found.");
  if (!isManualColumn(col))
    throw new Error("This column is formula-computed, not manual.");
  const slip = await prisma.payslip.findFirst({
    where: { id: payslipId, run: { tenantId } },
    select: { id: true },
  });
  if (!slip) throw new Error("Payslip not found.");
  const v = Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
  await prisma.payslipCustomValue.upsert({
    where: { payslipId_columnId: { payslipId, columnId } },
    create: { payslipId, columnId, value: v },
    update: { value: v },
  });
}

// ─── Built-in (base) column overrides + persisted recompute ─────────────
// Admins may rename / hide / regroup / formula-override BUILT-IN leaf
// columns. Each change triggers a persisted recompute of EVERY run for the
// tenant (including completed/paid — no guard, by product decision). The
// recompute always derives from an immutable pristine baseline snapshot so
// repeated or reverted edits never compound or corrupt payroll. A restore
// point of the pre-change state is also captured for one-click undo.

type LeafKind = "money" | "count";
const LEAF_FIELDS: Record<
  string,
  { header: string; lineName: string; group: "earning" | "deduction"; kind: LeafKind; code: string; sort: number }
> = {
  basicSalary:      { header: "Basic",               lineName: "Basic Salary",         group: "earning",   kind: "money", code: "BASIC",   sort: 0 },
  houseRent:        { header: "House Rent",          lineName: "House Rent",           group: "earning",   kind: "money", code: "HRENT",   sort: 10 },
  health:           { header: "Health",              lineName: "Health Allowance",     group: "earning",   kind: "money", code: "HEALTH",  sort: 20 },
  education:        { header: "Education",           lineName: "Education Allowance",  group: "earning",   kind: "money", code: "EDU",     sort: 30 },
  savings:          { header: "Savings",             lineName: "Savings",              group: "earning",   kind: "money", code: "SAV",     sort: 40 },
  dailyHand:        { header: "Daily Hand Expenses", lineName: "Daily Hand Expenses",  group: "earning",   kind: "money", code: "DHEXP",   sort: 50 },
  advanceRecovered: { header: "Advance Recovery",    lineName: "Advance Recovery",     group: "deduction", kind: "money", code: "ADVANCE", sort: 910 },
  extraDutyDays:    { header: "Extra Duty Days",     lineName: "Extra Duty Days",      group: "earning",   kind: "count", code: "EXTRADUTYDAYS", sort: 60 },
  absentDays:       { header: "Absent Days",         lineName: "Absent Days",          group: "deduction", kind: "count", code: "ABSENTDAYS",    sort: 900 },
};
const LEAF_KEYS = Object.keys(LEAF_FIELDS);
const MONEY_EARN_LEAVES = ["basicSalary", "houseRent", "health", "education", "savings", "dailyHand"];

export type BaseOverrideRow = {
  fieldKey: string;
  nameOverride: string | null;
  shortLabelOverride: string | null;
  hidden: boolean;
  groupOverride: "earning" | "deduction" | null;
  formula: unknown;
};

export function listBaseColumnOverrides(tenantId: string) {
  return prisma.payrollBaseColumnOverride.findMany({ where: { tenantId } });
}

/** Built-in leaf columns merged with their per-tenant overrides (for UI). */
export async function getEffectiveBaseColumns(tenantId: string) {
  const rows = await listBaseColumnOverrides(tenantId);
  const m = new Map(rows.map((r) => [r.fieldKey, r]));
  return LEAF_KEYS.map((k) => {
    const o = m.get(k);
    const d = LEAF_FIELDS[k];
    return {
      key: k,
      kind: d.kind,
      label: o?.nameOverride?.trim() || d.header,
      defaultLabel: d.header,
      shortLabel: o?.shortLabelOverride?.trim() || o?.nameOverride?.trim() || d.header,
      group: (o?.groupOverride ?? d.group) as "earning" | "deduction",
      defaultGroup: d.group,
      hidden: !!o?.hidden,
      formula: parseFormula(o?.formula),
      formulaText: o?.formula
        ? describeCustomColumn({
            formula: o.formula,
            operation: "add",
            sourceField: k,
            operandKind: "field",
            operandField: null,
            operandValue: null,
          })
        : "",
      overridden: !!o,
    };
  });
}

function validateBaseFormula(formula: FormulaRow[] | null) {
  if (!formula) return;
  if (!Array.isArray(formula) || formula.length === 0)
    throw new Error("Add at least one value to the formula.");
  for (const s of formula) {
    if (!(OPS as readonly string[]).includes(s.op))
      throw new Error("Operation must be ×, +, − or ÷.");
    if (s.kind === "field") {
      if (!FIELD_KEYS.includes(s.field)) throw new Error("Pick a valid column.");
    } else if (s.kind === "const") {
      if (!Number.isFinite(s.value)) throw new Error("Enter a valid number.");
    } else throw new Error("Invalid value.");
  }
}

/** Create/update one built-in leaf override (does NOT recompute). */
export async function setBaseColumnOverride(
  tenantId: string,
  fieldKey: string,
  patch: {
    nameOverride?: string | null;
    shortLabelOverride?: string | null;
    hidden?: boolean;
    groupOverride?: "earning" | "deduction" | null;
    formula?: FormulaRow[] | null;
  }
) {
  if (!LEAF_KEYS.includes(fieldKey))
    throw new Error("That column cannot be edited (only built-in leaf columns).");
  if (LEAF_FIELDS[fieldKey].kind === "count" && patch.groupOverride)
    throw new Error("Day-count columns cannot change Earnings/Deductions group.");
  validateBaseFormula(patch.formula ?? null);
  const data = {
    nameOverride: patch.nameOverride?.trim() || null,
    shortLabelOverride: patch.shortLabelOverride?.trim() || null,
    hidden: !!patch.hidden,
    groupOverride: patch.groupOverride ?? null,
    // Nullable Json: a plain JS `null` is rejected by Prisma at runtime —
    // use Prisma.JsonNull to clear the formula.
    formula: patch.formula
      ? (patch.formula as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
  await prisma.payrollBaseColumnOverride.upsert({
    where: { tenantId_fieldKey: { tenantId, fieldKey } },
    create: { tenantId, fieldKey, ...data },
    update: data,
  });
}

/** Remove a built-in override (back to the engine default; does NOT recompute). */
export async function clearBaseColumnOverride(tenantId: string, fieldKey: string) {
  await prisma.payrollBaseColumnOverride.deleteMany({
    where: { tenantId, fieldKey },
  });
}

type SnapSlip = Record<string, unknown> & { id: string; runId: string };
type SnapLine = {
  payslipId: string;
  componentName: string;
  componentCode: string;
  amount: number;
  type: string;
  sortOrder: number;
};
type Snapshot = {
  runs: { id: string }[];
  payslips: SnapSlip[];
  lines: SnapLine[];
};

const N = (v: unknown) => Number(v ?? 0);

async function snapshotTenant(tenantId: string): Promise<Snapshot> {
  const runs = await prisma.payrollRun.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const runIds = runs.map((r) => r.id);
  const payslips = await prisma.payslip.findMany({
    where: { runId: { in: runIds } },
  });
  const lines = await prisma.payslipLine.findMany({
    where: { payslip: { runId: { in: runIds } } },
    select: {
      payslipId: true,
      componentName: true,
      componentCode: true,
      amount: true,
      type: true,
      sortOrder: true,
    },
  });
  return {
    runs,
    payslips: payslips.map((p) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p))
        o[k] =
          v && typeof v === "object" && "toString" in v && !(v instanceof Date)
            ? Number(v.toString())
            : v;
      return o as SnapSlip;
    }),
    lines: lines.map((l) => ({
      payslipId: l.payslipId,
      componentName: l.componentName,
      componentCode: l.componentCode,
      amount: N(l.amount),
      type: l.type as string,
      sortOrder: l.sortOrder,
    })),
  };
}

/** The immutable pristine baseline (captured once, before the first edit). */
async function ensureBaseline(tenantId: string): Promise<Snapshot> {
  const existing = await prisma.payrollRecomputeBackup.findFirst({
    where: { tenantId, reason: "baseline" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.snapshot as unknown as Snapshot;
  const snap = await snapshotTenant(tenantId);
  await prisma.payrollRecomputeBackup.create({
    data: {
      tenantId,
      reason: "baseline",
      runCount: snap.runs.length,
      slipCount: snap.payslips.length,
      snapshot: snap as unknown as Prisma.InputJsonValue,
    },
  });
  return snap;
}

function evalLeaf(
  key: string,
  raw: Record<string, number>,
  o: BaseOverrideRow | undefined
): number {
  if (o?.hidden) return 0;
  if (o?.formula)
    return round2(
      computeCustomColumnValue(
        {
          formula: o.formula,
          operation: "add",
          sourceField: key,
          operandKind: "field",
          operandField: null,
          operandValue: null,
        },
        raw
      )
    );
  return round2(N(raw[key]));
}

/**
 * Recompute a single payslip from its PRISTINE values, applying overrides.
 * Mirrors the run/updatePayslip math; aggregates stay engine-derived.
 */
function recomputeSlip(
  s: SnapSlip,
  slipLines: SnapLine[],
  oMap: Map<string, BaseOverrideRow>
) {
  const raw: Record<string, number> = {
    basicSalary: N(s.basicSalary),
    houseRent: N(s.houseRent),
    health: N(s.health),
    education: N(s.education),
    savings: N(s.savings),
    dailyHand: N(s.dailyHand),
    extraDutyDays: N(s.extraDutyDays),
    extraDutyPayment: N(s.extraDutyPayment),
    totalEarnings: N(s.totalEarnings),
    totalSalary: N(s.totalSalary),
    advanceRecovered: N(s.advanceRecovered),
    absentDays: N(s.absentDays),
    absenceDeduction: N(s.absenceDeduction),
    payableSalary: N(s.payableSalary),
  };
  const og = (k: string) => oMap.get(k);
  const grp = (k: string): "earning" | "deduction" =>
    og(k)?.groupOverride ?? LEAF_FIELDS[k].group;
  const eff: Record<string, number> = {};
  for (const k of LEAF_KEYS) eff[k] = evalLeaf(k, raw, og(k));

  const basic = eff.basicSalary;
  let gross = 0;
  let regroupDed = 0;
  for (const k of MONEY_EARN_LEAVES) {
    if (og(k)?.hidden) continue;
    if (grp(k) === "earning") gross += eff[k];
    else regroupDed += eff[k];
  }
  gross = round2(gross);

  const edDays = eff.extraDutyDays;
  const extraDutyPayment = round2((basic / 30) * edDays);
  const absDays = eff.absentDays;
  const absenceDeduction = round2((basic / 30) * absDays);

  const builtin = new Set([
    "BASIC", "HRENT", "HEALTH", "EDU", "SAV", "DHEXP",
    "EXTRADUTY", "ABSENT", "ADVANCE",
  ]);
  const customDed = slipLines.filter(
    (l) => l.type === "deduction" && !builtin.has(l.componentCode)
  );
  const otherDeductions = round2(
    customDed.reduce((a, l) => a + N(l.amount), 0)
  );

  const advG = grp("advanceRecovered");
  const advance = og("advanceRecovered")?.hidden ? 0 : eff.advanceRecovered;
  const advAsDed = advG === "deduction" ? advance : 0;
  const advAsEarn = advG === "earning" ? advance : 0;

  const totalEarnings = round2(gross + advAsEarn);
  const totalSalary = round2(totalEarnings + extraDutyPayment);
  const totalDed = round2(
    otherDeductions + absenceDeduction + advAsDed + regroupDed
  );
  const payableSalary = round2(totalSalary - totalDed);

  const nameOf = (k: string) =>
    og(k)?.nameOverride?.trim() || LEAF_FIELDS[k].lineName;
  const lines: SnapLine[] = [];
  for (const k of MONEY_EARN_LEAVES) {
    if (og(k)?.hidden) continue;
    const amt = eff[k];
    if (k !== "basicSalary" && amt <= 0) continue;
    lines.push({
      payslipId: s.id,
      componentName: nameOf(k),
      componentCode: LEAF_FIELDS[k].code,
      amount: round2(amt),
      type: grp(k),
      sortOrder: LEAF_FIELDS[k].sort,
    });
  }
  if (extraDutyPayment > 0)
    lines.push({
      payslipId: s.id,
      componentName: `Extra Duty Payment (${edDays} day${edDays === 1 ? "" : "s"})`,
      componentCode: "EXTRADUTY",
      amount: extraDutyPayment,
      type: "earning",
      sortOrder: 60,
    });
  for (const l of customDed)
    lines.push({
      payslipId: s.id,
      componentName: l.componentName,
      componentCode: l.componentCode,
      amount: round2(N(l.amount)),
      type: "deduction",
      sortOrder: l.sortOrder,
    });
  if (absenceDeduction > 0)
    lines.push({
      payslipId: s.id,
      componentName:
        `Absence Deduction (${absDays} day${absDays === 1 ? "" : "s"})` +
        (s.absenceReason ? ` — ${String(s.absenceReason)}` : ""),
      componentCode: "ABSENT",
      amount: absenceDeduction,
      type: "deduction",
      sortOrder: 900,
    });
  if (advance > 0)
    lines.push({
      payslipId: s.id,
      componentName: nameOf("advanceRecovered"),
      componentCode: "ADVANCE",
      amount: advance,
      type: advG,
      sortOrder: 910,
    });

  return {
    payslipId: s.id,
    runId: s.runId,
    data: {
      basicSalary: og("basicSalary")?.hidden ? 0 : basic,
      houseRent: og("houseRent")?.hidden ? 0 : eff.houseRent,
      health: og("health")?.hidden ? 0 : eff.health,
      education: og("education")?.hidden ? 0 : eff.education,
      savings: og("savings")?.hidden ? 0 : eff.savings,
      dailyHand: og("dailyHand")?.hidden ? 0 : eff.dailyHand,
      extraDutyDays: edDays,
      extraDutyPayment,
      totalEarnings,
      totalSalary,
      absentDays: absDays,
      absenceDeduction,
      advanceRecovered: advance,
      totalDeductions: totalDed,
      netPay: payableSalary,
      payableSalary,
      amountPaid: payableSalary,
    },
    lines: lines.map((l) => ({
      componentName: l.componentName,
      componentCode: l.componentCode,
      amount: l.amount,
      type: l.type as "earning" | "deduction" | "reimbursement",
      sortOrder: l.sortOrder,
    })),
  };
}

export type RecomputeSummary = {
  runs: number;
  payslips: number;
  backupId: string;
};

/**
 * Persisted, tenant-wide recompute from the pristine baseline applying all
 * current overrides. Captures a pre-change restore point first.
 */
export async function recomputeTenantPayroll(
  tenantId: string,
  userId: string | undefined,
  reason: string
): Promise<RecomputeSummary> {
  const baseline = await ensureBaseline(tenantId);

  // Pre-change restore point (one-click undo of just this change).
  const now = await snapshotTenant(tenantId);
  const backup = await prisma.payrollRecomputeBackup.create({
    data: {
      tenantId,
      reason: reason.slice(0, 200),
      createdBy: userId ?? null,
      runCount: now.runs.length,
      slipCount: now.payslips.length,
      snapshot: now as unknown as Prisma.InputJsonValue,
    },
  });

  const overrides = await listBaseColumnOverrides(tenantId);
  const oMap = new Map<string, BaseOverrideRow>(
    overrides.map((o) => [
      o.fieldKey,
      {
        fieldKey: o.fieldKey,
        nameOverride: o.nameOverride,
        shortLabelOverride: o.shortLabelOverride,
        hidden: o.hidden,
        groupOverride: o.groupOverride as "earning" | "deduction" | null,
        formula: o.formula,
      },
    ])
  );

  const linesBySlip = new Map<string, SnapLine[]>();
  for (const l of baseline.lines) {
    const arr = linesBySlip.get(l.payslipId) ?? [];
    arr.push(l);
    linesBySlip.set(l.payslipId, arr);
  }
  const recomputed = baseline.payslips.map((s) =>
    recomputeSlip(s, linesBySlip.get(s.id) ?? [], oMap)
  );

  await prisma.$transaction(async (tx) => {
    for (const rc of recomputed) {
      await tx.payslipLine.deleteMany({ where: { payslipId: rc.payslipId } });
      await tx.payslip.update({
        where: { id: rc.payslipId },
        data: { ...rc.data, lines: { create: rc.lines } },
      });
    }
    for (const run of baseline.runs) {
      const agg = await tx.payslip.aggregate({
        where: { runId: run.id },
        _sum: { totalEarnings: true, totalDeductions: true, payableSalary: true },
      });
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          totalGross: round2(N(agg._sum.totalEarnings)),
          totalDeductions: round2(N(agg._sum.totalDeductions)),
          totalNet: round2(N(agg._sum.payableSalary)),
        },
      });
    }
  });

  return {
    runs: baseline.runs.length,
    payslips: recomputed.length,
    backupId: backup.id,
  };
}

/** Restore points available to undo a recompute (newest first). */
export function listRecomputeBackups(tenantId: string) {
  return prisma.payrollRecomputeBackup.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      runCount: true,
      slipCount: true,
      restoredAt: true,
      createdAt: true,
    },
  });
}

/** Write a backup snapshot back verbatim (full undo of a recompute). */
export async function restoreRecomputeBackup(
  tenantId: string,
  backupId: string
) {
  const b = await prisma.payrollRecomputeBackup.findFirst({
    where: { id: backupId, tenantId },
  });
  if (!b) throw new Error("Restore point not found.");
  const snap = b.snapshot as unknown as Snapshot;
  const linesBySlip = new Map<string, SnapLine[]>();
  for (const l of snap.lines) {
    const arr = linesBySlip.get(l.payslipId) ?? [];
    arr.push(l);
    linesBySlip.set(l.payslipId, arr);
  }
  await prisma.$transaction(async (tx) => {
    for (const s of snap.payslips) {
      await tx.payslipLine.deleteMany({ where: { payslipId: s.id } });
      await tx.payslip.update({
        where: { id: s.id },
        data: {
          basicSalary: N(s.basicSalary),
          houseRent: N(s.houseRent),
          health: N(s.health),
          education: N(s.education),
          savings: N(s.savings),
          dailyHand: N(s.dailyHand),
          extraDutyDays: N(s.extraDutyDays),
          extraDutyPayment: N(s.extraDutyPayment),
          totalEarnings: N(s.totalEarnings),
          totalSalary: N(s.totalSalary),
          absentDays: N(s.absentDays),
          absenceDeduction: N(s.absenceDeduction),
          advanceRecovered: N(s.advanceRecovered),
          totalDeductions: N(s.totalDeductions),
          netPay: N(s.netPay),
          payableSalary: N(s.payableSalary),
          amountPaid: N(s.amountPaid),
          lines: {
            create: (linesBySlip.get(s.id) ?? []).map((l) => ({
              componentName: l.componentName,
              componentCode: l.componentCode,
              amount: l.amount,
              type: l.type as "earning" | "deduction" | "reimbursement",
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
    }
    for (const r of snap.runs) {
      const agg = await tx.payslip.aggregate({
        where: { runId: r.id },
        _sum: { totalEarnings: true, totalDeductions: true, payableSalary: true },
      });
      await tx.payrollRun.update({
        where: { id: r.id },
        data: {
          totalGross: round2(N(agg._sum.totalEarnings)),
          totalDeductions: round2(N(agg._sum.totalDeductions)),
          totalNet: round2(N(agg._sum.payableSalary)),
        },
      });
    }
    await tx.payrollRecomputeBackup.update({
      where: { id: b.id },
      data: { restoredAt: new Date() },
    });
  });
  return { runs: snap.runs.length, payslips: snap.payslips.length };
}
