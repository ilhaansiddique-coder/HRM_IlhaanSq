import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface StopSyncPayload {
  sync_id?: string;
  syncLogId?: string;
}

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

    const body = (await req.json().catch(() => ({}))) as StopSyncPayload;
    const syncId = body.sync_id ?? body.syncLogId ?? null;

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);
    if (!["manager", "tenant_admin", "superadmin", "admin"].includes(authContext.role ?? "")) {
      throw new Error("Unauthorized: manager or above required");
    }

    const { error: flagError } = await supabaseAdmin.from("system_flags").upsert(
      {
        tenant_id: authContext.tenantId,
        key: "stop_sync",
        value: true,
        set_by: authContext.userId,
      },
      { onConflict: "tenant_id,key" },
    );
    if (flagError) {
      throw new Error(`Failed to set stop flag: ${flagError.message}`);
    }

    if (syncId) {
      const { error: syncUpdateError } = await supabaseAdmin
        .from("woocommerce_sync_logs")
        .update({
          status: "failed",
          error_message: "Cancelled by user",
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncId)
        .eq("tenant_id", authContext.tenantId);
      if (syncUpdateError) {
        console.error("Failed to mark sync as cancelled:", syncUpdateError.message);
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: authContext.tenantId,
      user_id: authContext.userId,
      action: "sync.stop",
      resource: "sync",
      resource_id: syncId ?? undefined,
      metadata: { sync_id: syncId },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("stop-sync error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
