import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

export async function listAttendance(
  tenantId: string,
  filters: { employeeId?: string; from?: Date; to?: Date } = {}
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      date: {
        gte: filters.from ?? monthStart,
        ...(filters.to && { lte: filters.to }),
      },
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

export async function checkIn(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  return prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    update: {
      checkIn: now,
      status: "present",
    },
    create: {
      tenantId,
      employeeId,
      date: today,
      checkIn: now,
      status: "present",
    },
  });
}

export async function checkOut(tenantId: string, employeeId: string) {
  await assertTenantOwns(tenantId, "employee", [employeeId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });

  if (!record || !record.checkIn) {
    throw new Error("Cannot check out without first checking in today");
  }

  const workMs = now.getTime() - record.checkIn.getTime();
  const workHours = Math.round((workMs / 3_600_000) * 100) / 100;

  return prisma.attendanceRecord.update({
    where: { employeeId_date: { employeeId, date: today } },
    data: {
      checkOut: now,
      workHours,
    },
  });
}

export async function getAttendanceStats(tenantId: string, date?: Date) {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);

  const [present, totalActive] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { tenantId, date: targetDate, status: "present" },
    }),
    prisma.employee.count({ where: { tenantId, status: "active" } }),
  ]);

  return {
    present,
    totalActive,
    absent: totalActive - present,
    attendanceRate: totalActive > 0 ? Math.round((present / totalActive) * 100) : 0,
  };
}
