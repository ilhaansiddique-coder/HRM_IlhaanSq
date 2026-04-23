import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  ensureRolePermission,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";

const VALID_ROLES = ["tenant_admin", "manager", "staff", "viewer"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

interface CreateUserPayload {
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  password?: string;
  tenantId?: string;
  tenant_id?: string;
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
    const supabaseAdmin = createServiceClient();

    let payload: CreateUserPayload = {};
    try {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        payload = (await req.json()) as CreateUserPayload;
      }
    } catch {
      payload = {};
    }

    const token = extractAccessToken(req) ?? "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedTenantId = String(payload.tenantId ?? payload.tenant_id ?? "").trim() || null;
    const authContext = await resolveTenantAuthContext(supabaseAdmin, token, requestedTenantId);
    const callerRole = authContext.role ?? "";
    const isSuperAdmin = callerRole === "superadmin";
    const isTenantAdmin = callerRole === "tenant_admin" || callerRole === "admin";
    if (!isSuperAdmin && !isTenantAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }
    if (!isSuperAdmin) {
      const canManageRoles = await ensureRolePermission(
        supabaseAdmin,
        callerRole,
        "admin.manage_roles",
        authContext.tenantId,
      );
      if (!canManageRoles) {
        throw new Error("Unauthorized: admin.manage_roles permission required");
      }
    }

    const fullName = (payload.full_name ?? "").trim();
    const email = (payload.email ?? "").trim().toLowerCase();
    const phone = payload.phone ?? null;
    const role = (payload.role ?? "").trim() as ValidRole;
    if (!fullName || !email || !role) {
      throw new Error("Full name, email and role are required");
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error("Invalid role");
    }

    const tempPassword = (payload.password ?? "").trim() || generateTempPassword(10);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        created_by: authContext.userId,
        created_at: new Date().toISOString(),
      },
    });
    if (createError || !newUser.user) {
      throw new Error(`Failed to create user: ${createError?.message ?? "Unknown error"}`);
    }

    const newUserId = newUser.user.id;

    const { error: roleUpsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: newUserId,
          role,
        },
        { onConflict: "user_id" },
      );
    if (roleUpsertError) {
      throw new Error(`Failed to assign role: ${roleUpsertError.message}`);
    }

    const profilePayload = {
      id: newUserId,
      full_name: fullName,
      email,
      phone,
      tenant_id: authContext.tenantId,
      force_password_reset: true,
      is_active: true,
      created_by: authContext.userId,
    };

    let { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileUpsertError && /force_password_reset|is_active|created_by|tenant_id/i.test(profileUpsertError.message)) {
      const fallbackProfile = {
        id: newUserId,
        full_name: fullName,
        email,
        phone,
      };
      const fallback = await supabaseAdmin
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" });
      profileUpsertError = fallback.error;
    }

    if (profileUpsertError) {
      throw new Error(`Failed to upsert profile: ${profileUpsertError.message}`);
    }

    const memberRole = role === "viewer" ? "member" : role === "tenant_admin" ? "admin" : role;
    const { error: memberUpsertError } = await supabaseAdmin.from("tenant_members").upsert(
      {
        tenant_id: authContext.tenantId,
        user_id: newUserId,
        role: memberRole,
        is_default: true,
        is_active: true,
        invited_by: authContext.userId,
      },
      { onConflict: "tenant_id,user_id" },
    );
    if (memberUpsertError) {
      throw new Error(`Failed to assign tenant membership: ${memberUpsertError.message}`);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      tenant_id: authContext.tenantId,
      user_id: authContext.userId,
      action: "user.created",
      resource: "user",
      resource_id: newUserId,
      metadata: {
        created_by: authContext.userId,
        email,
        role,
        tenant_id: authContext.tenantId,
      },
    });
    if (auditError) {
      console.error("Audit log insert failed:", auditError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        email,
        temp_password: tempPassword,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("admin-create-user error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
