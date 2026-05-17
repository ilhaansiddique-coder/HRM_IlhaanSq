import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { exportTenantData } from "@/lib/services/backup.service";

export async function GET() {
  const session = await requireTenant();
  if (!["owner", "admin", "superadmin"].includes(session.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await exportTenantData(session.tenantId);
  const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
