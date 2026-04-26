import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { resolveDateBounds, formatDateLabel } from "@/lib/date-range";
import { getReportsPageData } from "@/lib/services/reports.service";

// Multi-sheet XLSX export of the Reports page for the current filter.
//   • Summary       — KPI strip + payment-method breakdown
//   • Items Sold    — per-product totals (sorted by value)
//   • Daily Perf    — histogram dataset (one row per day)
//
// Mirrors the same `range` / `from` / `to` URL params the Reports page
// uses so the spreadsheet always matches what the user is looking at.
//
// We stream binary to the client — Next.js's NextResponse handles
// Content-Type + Content-Disposition headers for the download.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireTenant();
  const url = new URL(request.url);
  const { start, end } = resolveDateBounds(
    url.searchParams.get("range"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    "today"
  );

  const scope = session.isSuperAdmin ? null : session.tenantId;
  const data = await getReportsPageData(scope, start, end);

  const wb = new ExcelJS.Workbook();
  wb.creator = "RaheDeen Inventory";
  wb.created = new Date();

  // Match the in-app currency formatting style. exceljs interprets
  // `#,##0` / `#,##0.00` natively — no need for the symbol here since
  // the source-of-truth currency lives in SystemSettings (per-tenant).
  const currencyFmt = "#,##0.00";
  const intFmt = "#,##0";

  // ─── Sheet 1: Summary ─────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 20 },
  ];
  summary.getRow(1).font = { bold: true };

  summary.addRows([
    { metric: "Date Range", value: formatDateLabel(start, end) },
    { metric: "Scope", value: session.isSuperAdmin ? "All tenants" : "Current tenant" },
    { metric: "Generated At", value: new Date().toISOString() },
    {},
    { metric: "Total Revenue", value: data.summary.totalRevenue },
    { metric: "Total Orders", value: data.summary.totalOrders },
    { metric: "Successful Orders", value: data.summary.successfulOrders },
    { metric: "Cancelled Orders", value: data.summary.cancelledOrders },
    { metric: "Avg Order Value", value: data.summary.avgOrderValue },
    {},
    { metric: "Total Sold Items", value: data.itemsTotals.totalQty },
    { metric: "Sold Items Value", value: data.itemsTotals.totalValue },
    { metric: "Returned Items", value: data.itemsTotals.returnedQty },
  ]);

  // Format the numeric rows. Header row (1) + 3 meta + blank = 5,
  // then 5 KPIs (rows 5–9), blank, then 3 items totals (rows 11–13).
  for (const rowNum of [5, 9, 12]) summary.getCell(`B${rowNum}`).numFmt = currencyFmt;
  for (const rowNum of [6, 7, 8, 11, 13]) summary.getCell(`B${rowNum}`).numFmt = intFmt;

  // Payment method breakdown (appended after the KPI block)
  if (data.paymentBreakdown.length > 0) {
    summary.addRow({});
    summary.addRow({ metric: "Payment Method", value: "Revenue / Orders" }).font = { bold: true };
    for (const p of data.paymentBreakdown) {
      const row = summary.addRow({
        metric: p.label,
        value: p.total,
      });
      row.getCell(2).numFmt = currencyFmt;
      // Stash the order count in column C so it's visible alongside.
      row.getCell(3).value = p.count;
      row.getCell(3).numFmt = intFmt;
    }
    // Add a header label for column C since it was opportunistically used.
    summary.getCell("C1").value = "Order Count";
    summary.getCell("C1").font = { bold: true };
    summary.getColumn(3).width = 14;
  }

  // ─── Sheet 2: Items Sold ──────────────────────────────────
  const items = wb.addWorksheet("Items Sold");
  items.columns = [
    { header: "Product", key: "name", width: 36 },
    { header: "Quantity", key: "qty", width: 12 },
    { header: "Total Value", key: "value", width: 16 },
  ];
  items.getRow(1).font = { bold: true };
  for (const row of data.itemsSold) {
    const r = items.addRow({
      name: row.productName,
      qty: row.totalQuantity,
      value: row.totalValue,
    });
    r.getCell("qty").numFmt = intFmt;
    r.getCell("value").numFmt = currencyFmt;
  }
  items.addRow({});
  const itemsFooter = items.addRow({
    name: "TOTAL",
    qty: data.itemsTotals.totalQty,
    value: data.itemsTotals.totalValue,
  });
  itemsFooter.font = { bold: true };
  itemsFooter.getCell("qty").numFmt = intFmt;
  itemsFooter.getCell("value").numFmt = currencyFmt;

  // ─── Sheet 3: Daily Performance ───────────────────────────
  const daily = wb.addWorksheet("Daily Performance");
  daily.columns = [
    { header: "Date", key: "iso", width: 14 },
    { header: "Label", key: "date", width: 12 },
    { header: "Revenue", key: "revenue", width: 16 },
    { header: "Orders", key: "orders", width: 10 },
    { header: "New Customers", key: "customers", width: 16 },
    { header: "Avg Order", key: "avgOrder", width: 14 },
  ];
  daily.getRow(1).font = { bold: true };
  for (const row of data.daily) {
    const r = daily.addRow(row);
    r.getCell("revenue").numFmt = currencyFmt;
    r.getCell("orders").numFmt = intFmt;
    r.getCell("customers").numFmt = intFmt;
    r.getCell("avgOrder").numFmt = currencyFmt;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `reports-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
