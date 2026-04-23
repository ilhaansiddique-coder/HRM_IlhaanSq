import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { listCategories } from "@/lib/services/product-category.service";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireTenant();
  const categories = await listCategories(session.tenantId);
  return NextResponse.json({ categories });
}
