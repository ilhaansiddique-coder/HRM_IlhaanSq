import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

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

export async function addSalaryComponent(
  tenantId: string,
  input: {
    structureId: string;
    name: string;
    code: string;
    type: "earning" | "deduction";
    calculationType: "fixed" | "percent_of_basic" | "percent_of_gross";
    value: number;
    taxable?: boolean;
    isStatutory?: boolean;
  }
) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { id: input.structureId, tenantId },
  });
  if (!structure) throw new Error("Structure not found");

  const last = await prisma.salaryComponent.findFirst({
    where: { structureId: input.structureId },
    orderBy: { sortOrder: "desc" },
  });

  return prisma.salaryComponent.create({
    data: {
      structureId: input.structureId,
      name: input.name,
      code: input.code.toUpperCase(),
      type: input.type,
      calculationType: input.calculationType,
      value: input.value,
      taxable: input.taxable ?? false,
      isStatutory: input.isStatutory ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 10,
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
  return prisma.payrollRun.findFirst({
    where: { id, tenantId },
    include: {
      period: true,
      payslips: {
        include: { lines: { orderBy: { sortOrder: "asc" } } },
        orderBy: { generatedAt: "asc" },
      },
    },
  });
}

// ─── Run Payroll ────────────────────────────────────────────
// Simple Phase-1 calculation:
//   For each active employee with a salary structure:
//     basic = baseSalary
//     for each component:
//       amount = fixed value, OR (basic * pct), OR (gross * pct)
//     gross = basic + sum(earnings)
//     net = gross - sum(deductions)

export async function runPayroll(
  tenantId: string,
  input: {
    name: string;
    periodStart: Date;
    periodEnd: Date;
    payDate: Date;
    runBy?: string;
  }
) {
  // Create period
  const period = await prisma.payrollPeriod.create({
    data: {
      tenantId,
      name: input.name,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate,
      status: "processing",
    },
  });

  const run = await prisma.payrollRun.create({
    data: {
      tenantId,
      periodId: period.id,
      status: "processing",
      runBy: input.runBy,
    },
  });

  // Get all employees with active salary assignments
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
    let earnings = 0;
    let deductions = 0;
    const lines: Array<{
      componentName: string;
      componentCode: string;
      amount: number;
      type: "earning" | "deduction";
      sortOrder: number;
    }> = [];

    // Add Basic line
    lines.push({
      componentName: "Basic Salary",
      componentCode: "BASIC",
      amount: basic,
      type: "earning",
      sortOrder: 0,
    });
    earnings += basic;

    // Earnings first (so percent_of_gross can reference current gross)
    for (const comp of sal.structure.components.filter((c) => c.type === "earning")) {
      const value = Number(comp.value);
      let amount = 0;
      if (comp.calculationType === "fixed") amount = value;
      else if (comp.calculationType === "percent_of_basic")
        amount = (basic * value) / 100;
      else if (comp.calculationType === "percent_of_gross")
        amount = ((basic + earnings - basic) * value) / 100;

      lines.push({
        componentName: comp.name,
        componentCode: comp.code,
        amount,
        type: "earning",
        sortOrder: comp.sortOrder,
      });
      earnings += amount;
    }

    // Deductions
    const grossForCalc = earnings;
    for (const comp of sal.structure.components.filter((c) => c.type === "deduction")) {
      const value = Number(comp.value);
      let amount = 0;
      if (comp.calculationType === "fixed") amount = value;
      else if (comp.calculationType === "percent_of_basic")
        amount = (basic * value) / 100;
      else if (comp.calculationType === "percent_of_gross")
        amount = (grossForCalc * value) / 100;

      lines.push({
        componentName: comp.name,
        componentCode: comp.code,
        amount,
        type: "deduction",
        sortOrder: comp.sortOrder,
      });
      deductions += amount;
    }

    const net = earnings - deductions;
    totalGross += earnings;
    totalDeductions += deductions;
    totalNet += net;

    await prisma.payslip.create({
      data: {
        runId: run.id,
        employeeId: sal.employeeId,
        basicSalary: basic,
        totalEarnings: earnings,
        totalDeductions: deductions,
        netPay: net,
        currency: sal.currency,
        lines: { create: lines },
      },
    });
  }

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: salaries.length,
      completedAt: new Date(),
    },
  });

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: "locked" },
  });

  return { run, period, payslipCount: salaries.length };
}

// ─── Employee Salary Assignment ─────────────────────────────

export async function assignSalary(
  tenantId: string,
  input: {
    employeeId: string;
    structureId: string;
    baseSalary: number;
    currency?: string;
    effectiveFrom: Date;
  }
) {
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "salaryStructure", [input.structureId]);

  // End any current assignment
  await prisma.employeeSalary.updateMany({
    where: { employeeId: input.employeeId, effectiveTo: null },
    data: { effectiveTo: input.effectiveFrom },
  });

  return prisma.employeeSalary.create({
    data: {
      employeeId: input.employeeId,
      structureId: input.structureId,
      baseSalary: input.baseSalary,
      currency: input.currency ?? "BDT",
      effectiveFrom: input.effectiveFrom,
    },
  });
}

export async function getPayrollStats(tenantId: string) {
  const [structureCount, runCount, activeSalaryCount, lastRun] = await Promise.all([
    prisma.salaryStructure.count({ where: { tenantId, isActive: true } }),
    prisma.payrollRun.count({ where: { tenantId } }),
    prisma.employeeSalary.count({
      where: { employee: { tenantId, status: "active" }, effectiveTo: null },
    }),
    prisma.payrollRun.findFirst({
      where: { tenantId, status: "completed" },
      orderBy: { completedAt: "desc" },
      include: { period: true },
    }),
  ]);

  return { structureCount, runCount, activeSalaryCount, lastRun };
}
