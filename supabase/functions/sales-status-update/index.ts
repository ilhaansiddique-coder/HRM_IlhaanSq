import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  ensureRolePermission,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface SaleStatusUpdatePayload {
  saleId?: string;
  update?: Record<string, unknown>;
}

const SALE_STATUS_SELECT = "id, courier_status, payment_status, amount_paid, amount_due";

const allowedUpdateFields = new Set([
  "courier_status",
  "order_status",
  "last_status_check",
  "cn_number",
  "consignment_id",
  "payment_status",
  "amount_paid",
  "amount_due",
  "status_backup_payment_status",
  "status_backup_amount_paid",
  "status_backup_amount_due",
]);

const numericUpdateFields = new Set([
  "amount_paid",
  "amount_due",
  "status_backup_amount_paid",
  "status_backup_amount_due",
]);

const nullableStringFields = new Set([
  "courier_status",
  "order_status",
  "cn_number",
  "consignment_id",
  "payment_status",
  "status_backup_payment_status",
]);

const sanitizeUpdatePayload = (rawUpdate: Record<string, unknown> | undefined) => {
  if (!rawUpdate || typeof rawUpdate !== "object" || Array.isArray(rawUpdate)) {
    throw new Error("Update payload is required");
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(rawUpdate)) {
    if (!allowedUpdateFields.has(key)) {
      continue;
    }

    if (numericUpdateFields.has(key)) {
      if (rawValue === null) {
        sanitized[key] = null;
        continue;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        throw new Error(`Invalid numeric value for ${key}`);
      }

      sanitized[key] = numericValue;
      continue;
    }

    if (nullableStringFields.has(key)) {
      if (rawValue === null) {
        sanitized[key] = null;
        continue;
      }

      const stringValue = String(rawValue ?? "").trim();
      sanitized[key] = stringValue.length > 0 ? stringValue : null;
      continue;
    }

    sanitized[key] = rawValue;
  }

  if (!Object.keys(sanitized).length) {
    throw new Error("No supported sales status fields were provided");
  }

  return sanitized;
};

const resolveErrorStatus = (message: string) => {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("missing access token") ||
    normalized.includes("invalid token") ||
    normalized.includes("expired token")
  ) {
    return 401;
  }

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("permission required")
  ) {
    return 403;
  }

  if (normalized.includes("not found")) {
    return 404;
  }

  return 400;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: SaleStatusUpdatePayload = {};
    try {
      body = (await req.json()) as SaleStatusUpdatePayload;
    } catch {
      body = {};
    }

    const saleId = String(body.saleId ?? "").trim();
    if (!saleId) {
      throw new Error("Sale id is required");
    }

    const updatePayload = sanitizeUpdatePayload(body.update);

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);
    const canEditSales = await ensureRolePermission(
      supabaseAdmin,
      authContext.role,
      "sales.edit",
      authContext.tenantId,
    );

    if (!canEditSales) {
      return new Response(JSON.stringify({ error: "Unauthorized: sales.edit permission required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sale, error: saleError } = await supabaseAdmin
      .from("sales")
      .select("id")
      .eq("id", saleId)
      .eq("tenant_id", authContext.tenantId)
      .maybeSingle();

    if (saleError) {
      throw new Error(`Failed to load sale: ${saleError.message}`);
    }

    if (!sale) {
      return new Response(JSON.stringify({ error: "Sale not found in your tenant" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updatedSale, error: updateError } = await supabaseAdmin
      .from("sales")
      .update(updatePayload)
      .eq("id", saleId)
      .eq("tenant_id", authContext.tenantId)
      .select(SALE_STATUS_SELECT)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update sale status: ${updateError.message}`);
    }

    if (!updatedSale) {
      throw new Error("Sale status update was not persisted");
    }

    return new Response(JSON.stringify(updatedSale), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("sales-status-update error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: resolveErrorStatus(message),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
