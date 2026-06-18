import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";
import { getEmployeePerformance } from "./task.service";
import { getWorkingDayChecker } from "./holiday.service";

// ─── Review Cycles ──────────────────────────────────────────

export async function listReviewCycles(tenantId: string) {
  return prisma.reviewCycle.findMany({
    where: { tenantId },
    include: {
      _count: { select: { goals: true, reviews: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function createReviewCycle(
  tenantId: string,
  input: { name: string; type: string; startDate: Date; endDate: Date }
) {
  return prisma.reviewCycle.create({
    data: { tenantId, ...input, status: "draft" },
  });
}

export async function activateCycle(tenantId: string, id: string) {
  const c = await prisma.reviewCycle.findFirst({ where: { id, tenantId } });
  if (!c) throw new Error("Cycle not found");
  return prisma.reviewCycle.update({
    where: { id },
    data: { status: "active" },
  });
}

export async function closeCycle(tenantId: string, id: string) {
  const c = await prisma.reviewCycle.findFirst({ where: { id, tenantId } });
  if (!c) throw new Error("Cycle not found");
  return prisma.reviewCycle.update({
    where: { id },
    data: { status: "closed" },
  });
}

// ─── Goals (OKR / KPI) ──────────────────────────────────────

export async function listGoals(
  tenantId: string,
  filters: { employeeId?: string; cycleId?: string; type?: "okr" | "kpi" } = {}
) {
  return prisma.goal.findMany({
    where: { tenantId, ...filters },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
      cycle: { select: { id: true, name: true } },
      // Goals with >=1 linked task are task-driven: their progress rolls up
      // automatically and the manual update form is suppressed in the UI.
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createGoal(
  tenantId: string,
  input: {
    employeeId: string;
    cycleId?: string;
    title: string;
    description?: string;
    type: "okr" | "kpi";
    targetValue?: number;
    unit?: string;
    weight?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "reviewCycle", [input.cycleId]);

  return prisma.goal.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      cycleId: input.cycleId,
      title: input.title,
      description: input.description,
      type: input.type,
      targetValue: input.targetValue,
      unit: input.unit,
      weight: input.weight ?? 100,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "not_started",
    },
  });
}

export async function updateGoalProgress(
  tenantId: string,
  id: string,
  input: { currentValue?: number; progress?: number; status?: any }
) {
  const goal = await prisma.goal.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!goal) throw new Error("Goal not found");

  // Task-driven goals own their progress via the task rollup — reject manual
  // overrides so the number always traces back to real task completion.
  if (goal._count.tasks > 0) {
    throw new Error("This goal is task-driven; progress updates automatically from its linked tasks.");
  }

  let newProgress = input.progress ?? goal.progress;
  if (input.currentValue !== undefined && goal.targetValue) {
    newProgress = Math.round((input.currentValue / Number(goal.targetValue)) * 100);
    newProgress = Math.min(100, Math.max(0, newProgress));
  }

  return prisma.goal.update({
    where: { id },
    data: {
      currentValue: input.currentValue ?? goal.currentValue,
      progress: newProgress,
      status: input.status ?? (newProgress >= 100 ? "achieved" : newProgress > 0 ? "in_progress" : goal.status),
    },
  });
}

export async function deleteGoal(tenantId: string, id: string) {
  const goal = await prisma.goal.findFirst({ where: { id, tenantId } });
  if (!goal) throw new Error("Goal not found");
  await prisma.goal.delete({ where: { id } });
}

// ─── Reviews ────────────────────────────────────────────────

export async function listReviews(
  tenantId: string,
  filters: { cycleId?: string; employeeId?: string } = {}
) {
  return prisma.review.findMany({
    where: { tenantId, ...filters },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
      reviewer: { select: { id: true, fullName: true } },
      cycle: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReview(
  tenantId: string,
  input: {
    cycleId: string;
    employeeId: string;
    reviewerId: string;
    type: "self" | "manager" | "peer" | "upward";
    overallRating?: number;
    strengths?: string;
    improvements?: string;
    comments?: string;
  }
) {
  await assertTenantOwns(tenantId, "reviewCycle", [input.cycleId]);
  await assertTenantOwns(tenantId, "employee", [input.employeeId, input.reviewerId]);

  return prisma.review.create({
    data: {
      tenantId,
      cycleId: input.cycleId,
      employeeId: input.employeeId,
      reviewerId: input.reviewerId,
      type: input.type,
      overallRating: input.overallRating,
      strengths: input.strengths,
      improvements: input.improvements,
      comments: input.comments,
      status: "submitted",
      submittedAt: new Date(),
    },
  });
}

// ─── Monthly automation (cycle + pre-filled draft reviews) ──────
//
// There is no OS-level cron in this deployment, so the monthly automation is
// idempotent and *load-triggered*: ensureMonthlyReviewCycle() is called when an
// admin opens the Performance page. It (1) find-or-creates an ACTIVE review
// cycle for the current month and (2) ensures every active employee has exactly
// one DRAFT review pre-filled from their task-derived productivity score. Safe
// to call any number of times — a (cycle, employee) draft is created once.

function monthMeta(ref: Date) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); // last day
  const name = ref.toLocaleString("en-US", { month: "long", year: "numeric" }); // "June 2026"
  return { start, end, name };
}

/** Map a 0–100 productivity score onto a 1–5 star overall rating. */
function scoreToRating(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

export async function ensureMonthlyReviewCycle(tenantId: string, ref: Date = new Date()) {
  const { start, end, name } = monthMeta(ref);

  // 1. Find-or-create this month's cycle (matched by type + date window so a
  //    timezone-shifted @db.Date never causes a duplicate).
  let cycle = await prisma.reviewCycle.findFirst({
    where: { tenantId, type: "monthly", startDate: { gte: start, lte: end } },
  });
  if (!cycle) {
    cycle = await prisma.reviewCycle.create({
      data: { tenantId, name, type: "monthly", startDate: start, endDate: end, status: "active" },
    });
  }

  // 2. One draft review per active employee, pre-filled from their task score.
  const [employees, existing, wd] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId, status: "active" },
      select: { id: true, managerId: true },
    }),
    prisma.review.findMany({
      where: { tenantId, cycleId: cycle.id },
      select: { employeeId: true },
    }),
    getWorkingDayChecker(tenantId),
  ]);
  const haveDraft = new Set(existing.map((r) => r.employeeId));

  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(end);
  to.setHours(23, 59, 59, 999);

  let createdDrafts = 0;
  for (const e of employees) {
    if (haveDraft.has(e.id)) continue;
    const perf = await getEmployeePerformance(tenantId, e.id, from, to, wd.isWorkingDay);
    await prisma.review.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        employeeId: e.id,
        // Manager review when a manager is set; otherwise a self-review draft.
        reviewerId: e.managerId ?? e.id,
        type: e.managerId ? "manager" : "self",
        overallRating: scoreToRating(perf.score),
        comments:
          `Auto-draft from ${name} task activity — score ${perf.score}/100, ` +
          `${perf.completed}/${perf.assigned} due tasks done, ${perf.throughput} completed, ` +
          `on-time ${perf.onTimeRatio}%, ${perf.activeDays} active days. ` +
          `Edit and submit to finalise.`,
        status: "draft",
      },
    });
    createdDrafts++;
  }

  return { cycle, createdDrafts };
}

export async function getPerformanceStats(tenantId: string) {
  const [cycleCount, activeCycles, goalCount, achievedGoals, reviewCount, draftReviews, submittedReviews] =
    await Promise.all([
      prisma.reviewCycle.count({ where: { tenantId } }),
      prisma.reviewCycle.count({ where: { tenantId, status: "active" } }),
      prisma.goal.count({ where: { tenantId } }),
      prisma.goal.count({ where: { tenantId, status: "achieved" } }),
      prisma.review.count({ where: { tenantId } }),
      // Auto-generated drafts await edit+submit; "submitted" counts the finalised
      // ones. The dashboard shows these separately so drafts aren't miscounted.
      prisma.review.count({ where: { tenantId, status: "draft" } }),
      prisma.review.count({ where: { tenantId, status: { not: "draft" } } }),
    ]);
  return { cycleCount, activeCycles, goalCount, achievedGoals, reviewCount, draftReviews, submittedReviews };
}
