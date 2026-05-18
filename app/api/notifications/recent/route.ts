import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight feed for the app-wide popup poller. Returns the tenant's most
// recent notifications + the server clock so the client can detect new ones
// without backfilling toasts for history on first load.
export async function GET() {
  try {
    const session = await requireTenant();

    const rows = await prisma.notification.findMany({
      where: session.isSuperAdmin ? {} : { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      now: new Date().toISOString(),
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        category: r.category,
        severity: r.severity,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch {
    // Never let the poller surface an error to the page.
    return NextResponse.json({ now: new Date().toISOString(), items: [] });
  }
}
