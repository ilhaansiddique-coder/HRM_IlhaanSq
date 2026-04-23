import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

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
  const goal = await prisma.goal.findFirst({ where: { id, tenantId } });
  if (!goal) throw new Error("Goal not found");

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

export async function getPerformanceStats(tenantId: string) {
  const [cycleCount, activeCycles, goalCount, achievedGoals, reviewCount] = await Promise.all([
    prisma.reviewCycle.count({ where: { tenantId } }),
    prisma.reviewCycle.count({ where: { tenantId, status: "active" } }),
    prisma.goal.count({ where: { tenantId } }),
    prisma.goal.count({ where: { tenantId, status: "achieved" } }),
    prisma.review.count({ where: { tenantId } }),
  ]);
  return { cycleCount, activeCycles, goalCount, achievedGoals, reviewCount };
}
