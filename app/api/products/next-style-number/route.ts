import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSkuPart, padStyleNumber, parseStyleFromSku } from "@/lib/sku";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await requireTenant();
  const url = new URL(req.url);
  const category = normalizeSkuPart(url.searchParams.get("category"));
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const rows = await prisma.product.findMany({
    where: {
      tenantId: session.tenantId,
      sku: { startsWith: `${category}-` },
    },
    select: { sku: true },
  });

  let max = 0;
  for (const r of rows) {
    const n = parseStyleFromSku(r.sku, category);
    if (n !== null && n > max) max = n;
  }

  const next = max + 1;
  return NextResponse.json({ style: padStyleNumber(next), styleNumber: next });
}
