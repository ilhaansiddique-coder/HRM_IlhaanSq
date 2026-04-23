import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { exportTenantData } from "@/lib/services/backup.service";

export async function GET() {
  const session = await requireTenant();
  if (!["owner", "admin", "superadmin"].includes(session.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await exportTenantData(session.tenantId);
  return NextResponse.json(data);
}
