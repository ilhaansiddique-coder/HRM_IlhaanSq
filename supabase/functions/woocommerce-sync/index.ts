import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface SyncPayload {
  connectionId?: string;
  syncType?: "manual" | "scheduled";
}

interface WooProduct {
  id: number;
  name: string;
  sku?: string;
  regular_price?: string;
  price?: string;
  stock_quantity?: number | null;
  images?: { src?: string }[];
}

const isStopRequested = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "object" && value !== null) {
    return (value as { stop?: boolean }).stop === true;
  }
  return false;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let syncLogId: string | null = null;
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as SyncPayload;
    const connectionId = body.connectionId;
    const syncType = body.syncType ?? "manual";
    if (!connectionId) {
      throw new Error("Missing connectionId");
    }

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);
    if (!["tenant_admin", "superadmin", "admin"].includes(authContext.role ?? "")) {
      throw new Error("Unauthorized: tenant_admin required");
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("woocommerce_connections")
      .select("id, tenant_id, site_url, consumer_key, consumer_secret")
      .eq("id", connectionId)
      .eq("tenant_id", authContext.tenantId)
      .maybeSingle();
    if (connectionError || !connection) {
      throw new Error("WooCommerce connection not found");
    }

    const { data: newLog, error: logCreateError } = await supabaseAdmin
      .from("woocommerce_sync_logs")
      .insert({
        connection_id: connectionId,
        sync_type: syncType,
        status: "in_progress",
        products_created: 0,
        products_updated: 0,
        products_failed: 0,
        tenant_id: authContext.tenantId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (logCreateError || !newLog?.id) {
      throw new Error(`Failed to create sync log: ${logCreateError?.message ?? "Unknown error"}`);
    }
    syncLogId = newLog.id;

    const readStopFlag = async () => {
      const { data: stopFlag } = await supabaseAdmin
        .from("system_flags")
        .select("value")
        .eq("tenant_id", authContext.tenantId)
        .eq("key", "stop_sync")
        .maybeSingle();
      return isStopRequested(stopFlag?.value);
    };

    if (await readStopFlag()) {
      throw new Error("Sync stopped by system flag");
    }

    const baseUrl = connection.site_url.replace(/\/+$/, "");
    let page = 1;
    let totalPages = 1;
    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    do {
      if (await readStopFlag()) {
        throw new Error("Sync stopped by system flag");
      }

      const url =
        `${baseUrl}/wp-json/wc/v3/products` +
        `?per_page=100&page=${page}` +
        `&consumer_key=${encodeURIComponent(connection.consumer_key)}` +
        `&consumer_secret=${encodeURIComponent(connection.consumer_secret)}`;

      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        throw new Error(`WooCommerce request failed (${response.status})`);
      }

      const pageTotalHeader = response.headers.get("x-wp-totalpages");
      totalPages = Number(pageTotalHeader ?? "1") || 1;

      const products = (await response.json()) as WooProduct[];
      for (const product of products) {
        try {
          const rate = Number(product.regular_price ?? product.price ?? "0");
          const stock = product.stock_quantity ?? 0;
          const imageUrl = product.images?.[0]?.src ?? null;

          const { data: existing } = await supabaseAdmin
            .from("products")
            .select("id")
            .eq("tenant_id", authContext.tenantId)
            .eq("woocommerce_id", product.id)
            .maybeSingle();

          if (existing?.id) {
            const { error: updateError } = await supabaseAdmin
              .from("products")
              .update({
                name: product.name,
                sku: product.sku ?? null,
                rate,
                stock_quantity: stock,
                image_url: imageUrl,
                last_synced_at: new Date().toISOString(),
                woocommerce_connection_id: connectionId,
              })
              .eq("id", existing.id)
              .eq("tenant_id", authContext.tenantId);
            if (updateError) {
              throw new Error(updateError.message);
            }
            updatedCount += 1;
          } else {
            const { error: insertError } = await supabaseAdmin.from("products").insert({
              tenant_id: authContext.tenantId,
              name: product.name,
              sku: product.sku ?? null,
              rate,
              stock_quantity: stock,
              image_url: imageUrl,
              has_variants: false,
              is_deleted: false,
              woocommerce_id: product.id,
              woocommerce_connection_id: connectionId,
              last_synced_at: new Date().toISOString(),
              created_by: authContext.userId,
            });
            if (insertError) {
              throw new Error(insertError.message);
            }
            createdCount += 1;
          }

          syncedCount += 1;
        } catch (productError) {
          failedCount += 1;
          const msg = productError instanceof Error ? productError.message : "Unknown product sync error";
          errors.push(`Product ${product.id}: ${msg}`);
        }
      }

      page += 1;
    } while (page <= totalPages);

    const { error: logUpdateError } = await supabaseAdmin
      .from("woocommerce_sync_logs")
      .update({
        status: failedCount > 0 ? "failed" : "completed",
        products_created: createdCount,
        products_updated: updatedCount,
        products_failed: failedCount,
        error_message: errors.length ? errors.slice(0, 20).join("; ") : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId);
    if (logUpdateError) {
      console.error("Failed to update sync log:", logUpdateError.message);
    }

    await supabaseAdmin.from("system_flags").upsert(
      {
        tenant_id: authContext.tenantId,
        key: "stop_sync",
        value: false,
        set_by: authContext.userId,
      },
      { onConflict: "tenant_id,key" },
    );

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: authContext.tenantId,
      user_id: authContext.userId,
      action: "sync.woocommerce",
      resource: "woocommerce_connection",
      resource_id: connectionId,
      metadata: {
        synced_count: syncedCount,
        products_created: createdCount,
        products_updated: updatedCount,
        products_failed: failedCount,
      },
    });

    return new Response(
      JSON.stringify({
        synced_count: syncedCount,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("woocommerce-sync error:", message);

    if (syncLogId) {
      const supabaseAdmin = createServiceClient();
      await supabaseAdmin
        .from("woocommerce_sync_logs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
