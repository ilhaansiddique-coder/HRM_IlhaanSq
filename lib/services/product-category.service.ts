import { prisma } from "../db";
import { deriveCategoryCode, normalizeSkuPart } from "../sku";

export type ProductCategoryRow = {
  id: string;
  code: string;
  label: string;
};

export async function listCategories(tenantId: string): Promise<ProductCategoryRow[]> {
  return prisma.productCategory.findMany({
    where: { tenantId },
    select: { id: true, code: true, label: true },
    orderBy: { label: "asc" },
  });
}

async function findFreeCode(tenantId: string, label: string): Promise<string> {
  const base = deriveCategoryCode(label);

  const existing = await prisma.productCategory.findUnique({
    where: { tenantId_code: { tenantId, code: base } },
  });
  if (!existing) return base;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`;
    const clash = await prisma.productCategory.findUnique({
      where: { tenantId_code: { tenantId, code: candidate } },
    });
    if (!clash) return candidate;
  }

  throw new Error("Unable to allocate a unique category code");
}

export async function ensureCategory(
  tenantId: string,
  userId: string,
  input: { code?: string; label: string }
): Promise<ProductCategoryRow> {
  const label = input.label.trim();
  if (!label) throw new Error("Category label is required");

  const byLabel = await prisma.productCategory.findUnique({
    where: { tenantId_label: { tenantId, label } },
    select: { id: true, code: true, label: true },
  });
  if (byLabel) return byLabel;

  const requestedCode = input.code ? normalizeSkuPart(input.code) : "";
  let code = requestedCode;
  if (code) {
    const clash = await prisma.productCategory.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (clash) code = await findFreeCode(tenantId, label);
  } else {
    code = await findFreeCode(tenantId, label);
  }

  const created = await prisma.productCategory.create({
    data: { tenantId, code, label, createdBy: userId },
    select: { id: true, code: true, label: true },
  });
  return created;
}
