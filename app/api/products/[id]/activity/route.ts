import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export type ActivityEntry = {
  id: string;
  action: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  details: Record<string, unknown> | null;
};

export type ActivityResponse = {
  createdAt: string | null;
  lastUpdatedAt: string | null;
  updateCount: number;
  entries: ActivityEntry[];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireTenant();
  const { id: productId } = await params;

  const owns = await prisma.product.findFirst({
    where: { id: productId, tenantId: session.tenantId },
    select: { id: true, createdAt: true },
  });
  if (!owns) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.activityLog.findMany({
    where: {
      tenantId: session.tenantId,
      entityType: "product",
      entityId: productId,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { fullName: true, email: true } },
    },
  });

  const entries: ActivityEntry[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.createdAt.toISOString(),
    userName: r.user?.fullName ?? "Unknown",
    userEmail: r.user?.email ?? "",
    details: (r.details ?? null) as Record<string, unknown> | null,
  }));

  const createEntry = rows.find((r) => r.action === "create");
  const updateEntries = rows.filter((r) => r.action === "update");
  const lastUpdate = updateEntries[0];

  const response: ActivityResponse = {
    createdAt:
      createEntry?.createdAt.toISOString() ?? owns.createdAt.toISOString(),
    lastUpdatedAt: lastUpdate ? lastUpdate.createdAt.toISOString() : null,
    updateCount: updateEntries.length,
    entries,
  };

  return NextResponse.json(response);
}
