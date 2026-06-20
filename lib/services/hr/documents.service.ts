import { prisma } from "../../db";
import { assertTenantOwns } from "./_shared";

// ─── Categories ─────────────────────────────────────────────

export async function listDocumentCategories(tenantId: string) {
  return prisma.documentCategory.findMany({
    where: { tenantId },
    include: { _count: { select: { documents: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createDocumentCategory(
  tenantId: string,
  input: {
    name: string;
    description?: string;
    retentionDays?: number;
    isRequired?: boolean;
  }
) {
  return prisma.documentCategory.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      retentionDays: input.retentionDays,
      isRequired: input.isRequired ?? false,
    },
  });
}

export async function deleteDocumentCategory(tenantId: string, id: string) {
  const c = await prisma.documentCategory.findFirst({ where: { id, tenantId } });
  if (!c) throw new Error("Category not found");
  const count = await prisma.employeeDocument.count({ where: { categoryId: id } });
  if (count > 0)
    throw new Error(`Cannot delete category with ${count} documents. Reassign first.`);
  await prisma.documentCategory.delete({ where: { id } });
}

// ─── Documents ──────────────────────────────────────────────

export async function listDocuments(
  tenantId: string,
  filters: {
    employeeId?: string;
    categoryId?: string;
    expiringSoon?: boolean;
    // Top-bar date filter — bounds the document list by upload time (createdAt).
    from?: Date;
    to?: Date;
  } = {}
) {
  const expiringSoonCutoff = new Date();
  expiringSoonCutoff.setDate(expiringSoonCutoff.getDate() + 30);

  return prisma.employeeDocument.findMany({
    where: {
      tenantId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.expiringSoon && {
        expiresAt: { lte: expiringSoonCutoff, gte: new Date() },
      }),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from && { gte: filters.from }),
              ...(filters.to && { lte: filters.to }),
            },
          }
        : {}),
    },
    include: {
      employee: { select: { id: true, fullName: true, empCode: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocument(
  tenantId: string,
  input: {
    employeeId: string;
    categoryId?: string;
    name: string;
    description?: string;
    fileUrl?: string;
    mimeType?: string;
    fileSize?: number;
    expiresAt?: Date;
    uploadedBy?: string;
  }
) {
  await assertTenantOwns(tenantId, "employee", [input.employeeId]);
  await assertTenantOwns(tenantId, "documentCategory", [input.categoryId]);

  return prisma.employeeDocument.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      categoryId: input.categoryId || null,
      name: input.name,
      description: input.description,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      expiresAt: input.expiresAt,
      uploadedBy: input.uploadedBy,
    },
  });
}

export async function markDocumentSigned(
  tenantId: string,
  id: string,
  signedByName: string
) {
  const d = await prisma.employeeDocument.findFirst({ where: { id, tenantId } });
  if (!d) throw new Error("Document not found");

  return prisma.employeeDocument.update({
    where: { id },
    data: {
      isSigned: true,
      signedAt: new Date(),
      signedByName,
    },
  });
}

export async function deleteDocument(tenantId: string, id: string) {
  const d = await prisma.employeeDocument.findFirst({ where: { id, tenantId } });
  if (!d) throw new Error("Document not found");
  await prisma.employeeDocument.delete({ where: { id } });
}

export async function getDocumentStats(tenantId: string) {
  const expiringSoonCutoff = new Date();
  expiringSoonCutoff.setDate(expiringSoonCutoff.getDate() + 30);

  const [total, signed, expiringSoon, expired] = await Promise.all([
    prisma.employeeDocument.count({ where: { tenantId } }),
    prisma.employeeDocument.count({ where: { tenantId, isSigned: true } }),
    prisma.employeeDocument.count({
      where: { tenantId, expiresAt: { lte: expiringSoonCutoff, gte: new Date() } },
    }),
    prisma.employeeDocument.count({
      where: { tenantId, expiresAt: { lt: new Date() } },
    }),
  ]);
  return { total, signed, expiringSoon, expired };
}
