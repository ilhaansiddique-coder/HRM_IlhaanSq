import { prisma } from "../../db";
import { randomBytes } from "crypto";
import { assertTenantOwns } from "./_shared";

// ─── Courses ────────────────────────────────────────────────

export async function listCourses(tenantId: string) {
  return prisma.course.findMany({
    where: { tenantId },
    include: {
      _count: { select: { enrollments: true, modules: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourse(tenantId: string, id: string) {
  return prisma.course.findFirst({
    where: { id, tenantId },
    include: {
      modules: { orderBy: { sortOrder: "asc" } },
      enrollments: {
        include: { employee: { select: { id: true, fullName: true, empCode: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });
}

export async function createCourse(
  tenantId: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    durationHours?: number;
    level?: any;
    instructorName?: string;
    isPublished?: boolean;
  }
) {
  return prisma.course.create({
    data: {
      tenantId,
      title: input.title,
      description: input.description,
      category: input.category,
      durationHours: input.durationHours,
      level: input.level ?? "beginner",
      instructorName: input.instructorName,
      isPublished: input.isPublished ?? false,
    },
  });
}

export async function publishCourse(tenantId: string, id: string) {
  const c = await prisma.course.findFirst({ where: { id, tenantId } });
  if (!c) throw new Error("Course not found");
  return prisma.course.update({
    where: { id },
    data: { isPublished: !c.isPublished },
  });
}

// ─── Course Modules ─────────────────────────────────────────

export async function addCourseModule(
  tenantId: string,
  input: {
    courseId: string;
    title: string;
    description?: string;
    contentUrl?: string;
    durationMinutes?: number;
  }
) {
  const c = await prisma.course.findFirst({ where: { id: input.courseId, tenantId } });
  if (!c) throw new Error("Course not found");

  const last = await prisma.courseModule.findFirst({
    where: { courseId: input.courseId },
    orderBy: { sortOrder: "desc" },
  });

  return prisma.courseModule.create({
    data: {
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      contentUrl: input.contentUrl,
      durationMinutes: input.durationMinutes,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });
}

// ─── Enrollments ────────────────────────────────────────────

export async function listEnrollments(
  tenantId: string,
  filters: { courseId?: string; employeeId?: string } = {}
) {
  return prisma.enrollment.findMany({
    where: { tenantId, ...filters },
    include: {
      course: { select: { id: true, title: true, category: true, durationHours: true } },
      employee: { select: { id: true, fullName: true, empCode: true } },
      certification: true,
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function enrollEmployee(
  tenantId: string,
  input: { courseId: string; employeeId: string }
) {
  await assertTenantOwns(tenantId, "course", [input.courseId]);
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);

  return prisma.enrollment.create({
    data: {
      tenantId,
      courseId: input.courseId,
      employeeId: input.employeeId,
      status: "enrolled",
    },
  });
}

export async function updateEnrollmentProgress(
  tenantId: string,
  id: string,
  progress: number
) {
  const enrollment = await prisma.enrollment.findFirst({ where: { id, tenantId } });
  if (!enrollment) throw new Error("Enrollment not found");

  const isCompleted = progress >= 100;
  const updated = await prisma.enrollment.update({
    where: { id },
    data: {
      progress: Math.min(100, Math.max(0, progress)),
      status: isCompleted ? "completed" : progress > 0 ? "in_progress" : "enrolled",
      startedAt: enrollment.startedAt ?? (progress > 0 ? new Date() : null),
      completedAt: isCompleted ? new Date() : null,
    },
  });

  // Auto-issue certification on completion
  if (isCompleted && !(await prisma.certification.findUnique({ where: { enrollmentId: id } }))) {
    const certNum = `CERT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await prisma.certification.create({
      data: { enrollmentId: id, certificateNumber: certNum },
    });
  }

  return updated;
}

export async function getLearningStats(tenantId: string) {
  const [courseCount, publishedCount, enrollmentCount, completedCount] = await Promise.all([
    prisma.course.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId, isPublished: true } }),
    prisma.enrollment.count({ where: { tenantId } }),
    prisma.enrollment.count({ where: { tenantId, status: "completed" } }),
  ]);
  return {
    courseCount,
    publishedCount,
    enrollmentCount,
    completedCount,
    completionRate:
      enrollmentCount > 0 ? Math.round((completedCount / enrollmentCount) * 100) : 0,
  };
}
