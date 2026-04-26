import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { tenantDb, prisma } from "@/lib/db";

// CSV export for the /invoices listing. Mirrors the Vite reference's
// "Export All" action (which generated per-invoice PDFs in a loop —
// here we ship a single CSV instead, because:
//   1. A single file is the right primitive for bulk export
//      (per-invoice PDF is already accessible from the row's eye icon).
//   2. CSV opens in Excel/Sheets/Numbers without any extra tooling.
//   3. PDF-per-invoice via html2canvas would mean N file downloads
//      and ~5–10s of CPU per invoice — terrible UX for any list >10.
//
// URL params accepted (all optional):
//   q         search across invoiceNumber + customerName
//   range     date preset key (today, yesterday, last_7_days,
//             last_30_days, this_month, this_year, all_time)
//   from/to   YYYY-MM-DD custom range (overridden by `range` if set)
//
// Filter logic mirrors InvoiceList exactly so the CSV matches what
// the user is currently looking at on screen.

function escapeCsvField(s: unknown): string {
  const str = s === null || s === undefined ? "" : String(s);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type DateBounds = { start: Date | null; end: Date | null };

function resolveDateBounds(
  rangeParam: string | null,
  fromParam: string | null,
  toParam: string | null
): DateBounds {
  if (rangeParam === "all_time") return { start: null, end: null };

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  if (rangeParam) {
    const now = new Date();
    switch (rangeParam) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday": {
        const y = addDays(now, -1);
        return { start: startOfDay(y), end: endOfDay(y) };
      }
      case "last_7_days":
        return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
      case "last_30_days":
        return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
      case "this_month":
        return {
          start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
          end: endOfDay(now),
        };
      case "this_year":
        return {
          start: startOfDay(new Date(now.getFullYear(), 0, 1)),
          end: endOfDay(now),
        };
    }
  }

  if (fromParam && toParam) {
    return {
      start: new Date(`${fromParam}T00:00:00`),
      end: new Date(`${toParam}T23:59:59.999`),
    };
  }

  // Default: today (matches the picker's defaultPreset).
  const now = new Date();
  return { start: startOfDay(now), end: endOfDay(now) };
}

export async function GET(request: Request) {
  const session = await requireTenant();
  const url = new URL(request.url);

  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  // `format=csv` (default) → returns the CSV file. `format=json` →
  // returns a JSON payload the client uses to build a PDF in-browser
  // via jspdf + jspdf-autotable. Same filter logic, different
  // serialization — keeps the two export formats in lockstep.
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const { start, end } = resolveDateBounds(
    url.searchParams.get("range"),
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  // Tenant scoping:
  //   • Super admin → use raw `prisma`, no tenant filter, but include
  //     the tenant relation so we can stamp each row with its owning
  //     tenant's name in the CSV/PDF output.
  //   • Tenant user → use `tenantDb(...)` which auto-injects the
  //     tenantId filter on every query. Same scoping rule the page
  //     uses, so the export always mirrors what the user sees.
  const dateFilter = start || end
    ? {
        createdAt: {
          ...(start ? { gte: start } : {}),
          ...(end ? { lte: end } : {}),
        },
      }
    : {};

  const baseSelect = {
    invoiceNumber: true,
    customerName: true,
    customerPhone: true,
    grandTotal: true,
    amountPaid: true,
    amountDue: true,
    paymentStatus: true,
    paymentMethod: true,
    paymentTerms: true,
    createdAt: true,
  } as const;

  const sales = session.isSuperAdmin
    ? await prisma.sale.findMany({
        where: { isDeleted: false, ...dateFilter },
        select: { ...baseSelect, tenant: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      })
    : await tenantDb(session.tenantId).sale.findMany({
        where: { isDeleted: false, ...dateFilter },
        select: baseSelect,
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

  const filtered = q
    ? sales.filter(
        (s) =>
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          // Search by tenant name too on super-admin exports.
          ("tenant" in s && (s.tenant as { name: string } | null)?.name
            ?.toLowerCase()
            .includes(q))
      )
    : sales;

  // Helper: pull the tenant name off a row (only present on
  // super-admin exports — gated by `session.isSuperAdmin` above).
  const tenantNameOf = (s: (typeof filtered)[number]): string => {
    if (!session.isSuperAdmin) return "";
    if ("tenant" in s) {
      const tn = (s.tenant as { name: string } | null)?.name;
      return tn ?? "";
    }
    return "";
  };

  // JSON branch — used by the PDF export path on the client.
  if (format === "json") {
    return NextResponse.json({
      rows: filtered.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        createdAt: s.createdAt.toISOString(),
        customerName: s.customerName,
        customerPhone: s.customerPhone ?? "",
        grandTotal: Number(s.grandTotal),
        amountPaid: Number(s.amountPaid),
        amountDue: Number(s.amountDue),
        paymentStatus: s.paymentStatus,
        paymentMethod: s.paymentMethod,
        paymentTerms: s.paymentTerms,
        // Only ever set on super-admin reads — empty string otherwise.
        tenantName: tenantNameOf(s),
      })),
      isSuperAdmin: session.isSuperAdmin,
      generatedAt: new Date().toISOString(),
    });
  }

  const headers = [
    ...(session.isSuperAdmin ? ["Tenant"] : []),
    "Invoice #",
    "Date",
    "Customer",
    "Phone",
    "Total",
    "Paid",
    "Due",
    "Status",
    "Method",
    "Terms",
  ];
  const lines: string[] = [headers.join(",")];
  for (const s of filtered) {
    lines.push(
      [
        ...(session.isSuperAdmin ? [escapeCsvField(tenantNameOf(s))] : []),
        escapeCsvField(s.invoiceNumber),
        escapeCsvField(s.createdAt.toISOString()),
        escapeCsvField(s.customerName),
        escapeCsvField(s.customerPhone ?? ""),
        escapeCsvField(Number(s.grandTotal).toFixed(2)),
        escapeCsvField(Number(s.amountPaid).toFixed(2)),
        escapeCsvField(Number(s.amountDue).toFixed(2)),
        escapeCsvField(s.paymentStatus),
        escapeCsvField(s.paymentMethod),
        escapeCsvField(s.paymentTerms),
      ].join(",")
    );
  }

  // Prepend the UTF-8 BOM so Excel auto-detects the encoding and
  // doesn't mangle non-ASCII characters (Bengali, accented Latin, …).
  const csv = "﻿" + lines.join("\r\n");

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `invoices-${datePart}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
