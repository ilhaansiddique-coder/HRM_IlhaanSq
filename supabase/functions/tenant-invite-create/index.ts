import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { ensureRolePermission, extractAccessToken, resolveTenantAuthContext } from "../_shared/authTenant.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";
import { isValidEmail, sanitizeString } from "../_shared/validation.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.sensitive, keyPrefix: "tenant-invite-create" },
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, corsHeaders);
  }

  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const requestedTenantId = String(body?.tenantId ?? body?.tenant_id ?? "").trim() || null;
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken, requestedTenantId);
    const callerRole = authContext.role ?? "";
    const isSuperAdmin = callerRole === "superadmin";
    const isTenantAdmin = callerRole === "tenant_admin" || callerRole === "admin";

    if (!isSuperAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Only admins can invite users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin) {
      const canManageRoles = await ensureRolePermission(
        supabaseAdmin,
        callerRole,
        "admin.manage_roles",
        authContext.tenantId,
      );

      if (!canManageRoles) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized: admin.manage_roles permission required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = String(body?.role ?? "member").trim();
    const expiresInDays = Number(body?.expires_in_days ?? 7);

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedRoles = ["owner", "admin", "manager", "staff", "member"];
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.max(1, Math.min(expiresInDays, 30)));

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("tenant_invites")
      .insert({
        tenant_id: authContext.tenantId,
        email,
        role,
        token,
        invited_by: userData.user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("token, email, role, expires_at")
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ success: false, error: inviteError?.message ?? "Failed to create invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLinkBase = sanitizeString(String(body?.invite_base_url ?? ""));
    const inviteLink = inviteLinkBase
      ? `${inviteLinkBase}?invite=${invite.token}`
      : null;

    return new Response(JSON.stringify({ success: true, invite, invite_link: inviteLink }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
