import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { resolveDateBounds } from "@/lib/date-range";
import {
  emptyCustomerStats,
  getAllTenantsCustomers,
  getCustomerLiveStats,
} from "@/lib/services/customer.service";
import { getCachedCustomers } from "@/lib/cache";

// XLSX export of the customers list, scoped to the same `q` /
// `range` / `from` / `to` URL params the page uses. The result
// always mirrors what the user is currently looking at on screen.
//
// Tenant scoping rule mirrors `/api/invoices/export`:
//   • Super admin → cross-tenant rows tagged with the owning tenant.
//   • Tenant user → just their tenant's customers.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireTenant();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const { start, end } = resolveDateBounds(
    url.searchParams.get("range"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    "all_time"
  );

  // Pull the same source the page reads from so the export is
  // byte-consistent with the table — cached customers + live folded
  // stats per tenant; cross-tenant list (no live stats) for super
  // admin.
  const customers = session.isSuperAdmin
    ? await getAllTenantsCustomers()
    : await getCachedCustomers(session.tenantId);
  const liveStats = session.isSuperAdmin
    ? new Map<string, ReturnType<typeof emptyCustomerStats>>()
    : await getCustomerLiveStats(session.tenantId);

  const filtered = customers.filter((c) => {
    if (start && c.createdAt < start) return false;
    if (end && c.createdAt > end) return false;
    if (!q) return true;
    const tenantName =
      "tenant" in c && c.tenant && typeof c.tenant === "object"
        ? (c.tenant as { name: string }).name
        : null;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.whatsapp ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.additionalInfo ?? "").toLowerCase().includes(q) ||
      tenantName?.toLowerCase().includes(q) ||
      false
    );
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "RaheDeen Inventory";
  wb.created = new Date();

  const ws = wb.addWorksheet("Customers");
  const baseColumns: { header: string; key: string; width: number }[] = [
    { header: "Name", key: "name", width: 28 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "WhatsApp", key: "whatsapp", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Address", key: "address", width: 32 },
    { header: "Status", key: "status", width: 12 },
    { header: "Notes", key: "notes", width: 24 },
    { header: "Credit Limit", key: "creditLimit", width: 14 },
    { header: "Orders", key: "orders", width: 10 },
    { header: "Delivered", key: "delivered", width: 12 },
    { header: "Cancelled", key: "cancelled", width: 12 },
    { header: "Total Spent", key: "totalSpent", width: 14 },
    { header: "Credit Due", key: "creditDue", width: 14 },
    { header: "Other Due", key: "otherDue", width: 14 },
    { header: "Created", key: "createdAt", width: 18 },
  ];
  ws.columns = session.isSuperAdmin
    ? [{ header: "Tenant", key: "tenant", width: 22 }, ...baseColumns]
    : baseColumns;
  ws.getRow(1).font = { bold: true };

  const intFmt = "#,##0";
  const currencyFmt = "#,##0.00";

  for (const c of filtered) {
    const stats = liveStats.get(c.id) ?? emptyCustomerStats();
    const tenantName =
      "tenant" in c && c.tenant && typeof c.tenant === "object"
        ? (c.tenant as { name: string }).name
        : "";

    const row = ws.addRow({
      ...(session.isSuperAdmin ? { tenant: tenantName } : {}),
      name: c.name,
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      status: c.status,
      notes: c.additionalInfo ?? "",
      creditLimit: c.creditLimit ? Number(c.creditLimit) : 0,
      orders: stats.orderCount || c.orderCount,
      delivered: stats.deliveredCount,
      cancelled: stats.cancelledCount,
      totalSpent: stats.totalSpent || Number(c.totalSpent ?? 0),
      creditDue: stats.creditDue,
      otherDue: stats.otherDue,
      createdAt: c.createdAt.toISOString().slice(0, 10),
    });
    row.getCell("creditLimit").numFmt = currencyFmt;
    row.getCell("orders").numFmt = intFmt;
    row.getCell("delivered").numFmt = intFmt;
    row.getCell("cancelled").numFmt = intFmt;
    row.getCell("totalSpent").numFmt = currencyFmt;
    row.getCell("creditDue").numFmt = currencyFmt;
    row.getCell("otherDue").numFmt = currencyFmt;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
