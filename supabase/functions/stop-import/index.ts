import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface StopImportPayload {
  import_id?: string;
  importLogId?: string;
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

    const body = (await req.json().catch(() => ({}))) as StopImportPayload;
    const importId = body.import_id ?? body.importLogId ?? null;

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);

    if (!["manager", "tenant_admin", "superadmin", "admin"].includes(authContext.role ?? "")) {
      throw new Error("Unauthorized: manager or above required");
    }

    const { error: flagError } = await supabaseAdmin.from("system_flags").upsert(
      {
        tenant_id: authContext.tenantId,
        key: "stop_import",
        value: true,
        set_by: authContext.userId,
      },
      { onConflict: "tenant_id,key" },
    );
    if (flagError) {
      throw new Error(`Failed to set stop flag: ${flagError.message}`);
    }

    if (importId) {
      const { error: importUpdateError } = await supabaseAdmin
        .from("woocommerce_import_logs")
        .update({
          status: "failed",
          error_message: "Cancelled by user",
          completed_at: new Date().toISOString(),
        })
        .eq("id", importId)
        .eq("tenant_id", authContext.tenantId);
      if (importUpdateError) {
        console.error("Failed to mark import as cancelled:", importUpdateError.message);
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: authContext.tenantId,
      user_id: authContext.userId,
      action: "import.stop",
      resource: "import",
      resource_id: importId ?? undefined,
      metadata: { import_id: importId },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("stop-import error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
