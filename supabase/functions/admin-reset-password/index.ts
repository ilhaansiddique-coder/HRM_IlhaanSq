import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

interface ResetPasswordPayload {
  user_id?: string;
}

const generateTempPassword = (length = 10): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
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

    let body: ResetPasswordPayload = {};
    try {
      body = (await req.json()) as ResetPasswordPayload;
    } catch {
      body = {};
    }

    const userId = body.user_id?.trim();
    if (!userId) {
      throw new Error("Missing user_id");
    }

    const supabaseAdmin = createServiceClient();
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken);

    const callerRole = authContext.role ?? "";
    const isSuperAdmin = callerRole === "superadmin";
    const isTenantAdmin = callerRole === "tenant_admin" || callerRole === "admin";
    if (!isSuperAdmin && !isTenantAdmin) {
      throw new Error("Unauthorized: tenant_admin or superadmin required");
    }

    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !targetProfile) {
      throw new Error("Target user not found");
    }

    if (!isSuperAdmin && targetProfile.tenant_id !== authContext.tenantId) {
      throw new Error("Unauthorized: cannot reset password outside your tenant");
    }

    const tempPassword = generateTempPassword(10);
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (authUpdateError) {
      throw new Error(`Failed to update password: ${authUpdateError.message}`);
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ force_password_reset: true })
      .eq("id", userId);
    if (profileUpdateError && !/force_password_reset/i.test(profileUpdateError.message)) {
      throw new Error(`Failed to set force_password_reset: ${profileUpdateError.message}`);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      tenant_id: targetProfile.tenant_id,
      user_id: authContext.userId,
      action: "user.password_reset",
      resource: "user",
      resource_id: userId,
      metadata: {
        reset_by: authContext.userId,
        tenant_id: targetProfile.tenant_id,
      },
    });
    if (auditError) {
      console.error("Failed to write audit log:", auditError.message);
    }

    return new Response(JSON.stringify({ success: true, temp_password: tempPassword }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("admin-reset-password error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
