import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { createCustomer } from "@/lib/services/customer.service";
import { invalidateCustomerCache } from "@/lib/cache";

// Bulk-create customers from an uploaded XLSX or CSV.
//
// Expected columns (case-insensitive header match — order doesn't
// matter, missing columns are fine):
//   Name | Phone | WhatsApp | Email | Address | Notes | Credit Limit
//
// Rows missing a Name are silently skipped and counted in `skipped`.
// Real failures (DB error, validation) are recorded per-row in
// `errors` so the user can fix and re-import. The response is JSON
// so the client can show a summary toast.
//
// Super-admin route is intentionally blocked — there's no single
// tenant to attach the rows to.

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ExcelJS depends on Node Buffer.

const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  "customer name": "name",
  phone: "phone",
  "phone number": "phone",
  whatsapp: "whatsapp",
  "whats app": "whatsapp",
  email: "email",
  "email address": "email",
  address: "address",
  notes: "additionalInfo",
  note: "additionalInfo",
  "additional info": "additionalInfo",
  "credit limit": "creditLimit",
  credit: "creditLimit",
};

type ImportRow = {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  additionalInfo?: string;
  creditLimit?: number;
};

type ImportError = { row: number; message: string };

function normalizeHeader(raw: unknown): string | null {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase();
  return COLUMN_ALIASES[key] ?? null;
}

function cellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  // Hyperlink / formula / rich text objects all expose `.text` or `.result`.
  const obj = v as { text?: string; result?: unknown; richText?: { text: string }[] };
  if (obj.text) return String(obj.text).trim();
  if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("").trim();
  if (obj.result != null) return String(obj.result).trim();
  return "";
}

export async function POST(request: Request) {
  const session = await requireTenant();
  if (session.isSuperAdmin) {
    return NextResponse.json(
      {
        error:
          "Super admin imports are not supported — switch to a tenant workspace first.",
      },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(uint8Array as any);
  } catch {
    return NextResponse.json(
      {
        error:
          "Failed to parse file. Please upload an .xlsx file (CSV not supported — open in Excel and Save As .xlsx).",
      },
      { status: 400 }
    );
  }

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    return NextResponse.json(
      { error: "Sheet is empty — at least a header row + one data row required" },
      { status: 400 }
    );
  }

  // Build a column-index → field-name map from the header row.
  const headerRow = ws.getRow(1);
  const fieldByCol = new Map<number, keyof ImportRow>();
  headerRow.eachCell((cell, colIndex) => {
    const field = normalizeHeader(cell.value);
    if (field) fieldByCol.set(colIndex, field as keyof ImportRow);
  });
  if (fieldByCol.size === 0 || ![...fieldByCol.values()].includes("name")) {
    return NextResponse.json(
      {
        error:
          "Couldn't find a recognizable header row. At minimum, include a 'Name' column.",
      },
      { status: 400 }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    if (row.cellCount === 0) continue;
    const data: ImportRow = {};
    fieldByCol.forEach((field, colIndex) => {
      const raw = cellValue(row.getCell(colIndex));
      if (!raw) return;
      if (field === "creditLimit") {
        const n = Number(raw);
        if (Number.isFinite(n)) data.creditLimit = n;
      } else {
        data[field] = raw;
      }
    });

    if (!data.name) {
      skipped += 1;
      continue;
    }

    try {
      await createCustomer(session.tenantId, session.userId, {
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        additionalInfo: data.additionalInfo,
        creditLimit: data.creditLimit,
      });
      created += 1;
    } catch (e) {
      errors.push({
        row: i,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  // createCustomer already invalidates per-call, but bulk-importing
  // hundreds of rows ends up doing that hundreds of times. One final
  // explicit invalidation is cheaper and the page revalidate below
  // will pick up the fresh data.
  await invalidateCustomerCache(session.tenantId);

  return NextResponse.json({
    created,
    skipped,
    errors,
    total: created + skipped + errors.length,
  });
}
