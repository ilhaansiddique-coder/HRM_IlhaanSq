import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

export async function listDepartments(tenantId: string) {
  return prisma.department.findMany({
    where: { tenantId },
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(
  tenantId: string,
  input: {
    name: string;
    code?: string;
    parentId?: string;
    costCenter?: string;
    description?: string;
  }
) {
  await assertTenantOwns(tenantId, "department", [input.parentId]);

  return prisma.department.create({
    data: {
      tenantId,
      name: input.name,
      code: input.code,
      parentId: input.parentId || null,
      costCenter: input.costCenter,
      description: input.description,
    },
  });
}

export async function updateDepartment(
  tenantId: string,
  id: string,
  input: Partial<Parameters<typeof createDepartment>[1]>
) {
  const existing = await prisma.department.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("Department not found");

  if (input.parentId !== undefined) {
    if (input.parentId === id) throw new Error("Department cannot be its own parent");
    await assertTenantOwns(tenantId, "department", [input.parentId]);
  }

  return prisma.department.update({
    where: { id },
    data: input,
  });
}

export async function deleteDepartment(tenantId: string, id: string) {
  const existing = await prisma.department.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("Department not found");

  // Check if there are employees in this dept
  const empCount = await prisma.employee.count({ where: { departmentId: id } });
  if (empCount > 0) {
    throw new Error(`Cannot delete department with ${empCount} active employees. Reassign them first.`);
  }

  await prisma.department.delete({ where: { id } });
}

// ─── Positions ──────────────────────────────────────────────

export async function listPositions(tenantId: string) {
  return prisma.position.findMany({
    where: { tenantId },
    include: {
      department: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { title: "asc" },
  });
}

export async function createPosition(
  tenantId: string,
  input: {
    title: string;
    departmentId?: string;
    grade?: string;
    band?: string;
    jobFamily?: string;
    isManager?: boolean;
    description?: string;
  }
) {
  await assertTenantOwns(tenantId, "department", [input.departmentId]);

  return prisma.position.create({
    data: {
      tenantId,
      title: input.title,
      departmentId: input.departmentId || null,
      grade: input.grade,
      band: input.band,
      jobFamily: input.jobFamily,
      isManager: input.isManager ?? false,
      description: input.description,
    },
  });
}

export async function deletePosition(tenantId: string, id: string) {
  const existing = await prisma.position.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("Position not found");

  const empCount = await prisma.employee.count({ where: { positionId: id } });
  if (empCount > 0) {
    throw new Error(`Cannot delete position with ${empCount} employees. Reassign them first.`);
  }

  await prisma.position.delete({ where: { id } });
}
