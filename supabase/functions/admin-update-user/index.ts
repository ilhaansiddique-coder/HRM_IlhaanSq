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

interface UpdatePayload {
  user_id?: string;
  userId?: string;
  tenantId?: string;
  tenant_id?: string;
  updates?: {
    role?: string;
    is_active?: boolean;
    full_name?: string;
    phone?: string | null;
    email?: string;
    password?: string;
  };
  role?: string;
  is_active?: boolean;
  full_name?: string;
  phone?: string | null;
  email?: string;
  password?: string;
}

const toTenantMembershipRole = (role?: string) => {
  switch (role) {
    case "tenant_admin":
      return "admin";
    case "manager":
      return "manager";
    case "viewer":
      return "member";
    case "staff":
    default:
      return "staff";
  }
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

    const body = (await req.json()) as UpdatePayload;
    const userId = body.user_id ?? body.userId;
    if (!userId) {
      throw new Error("Missing user_id");
    }

    const mergedUpdates = {
      role: body.updates?.role ?? body.role,
      is_active: body.updates?.is_active ?? body.is_active,
      full_name: body.updates?.full_name ?? body.full_name,
      phone: body.updates?.phone ?? body.phone,
      email: body.updates?.email ?? body.email,
      password: body.updates?.password ?? body.password,
    };

    const supabaseAdmin = createServiceClient();
    const requestedTenantId = String(body.tenantId ?? body.tenant_id ?? "").trim() || null;
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken, requestedTenantId);
    const callerRole = authContext.role ?? "";
    const isSuperAdmin = callerRole === "superadmin";
    const isTenantAdmin = callerRole === "tenant_admin" || callerRole === "admin";
    if (!isSuperAdmin && !isTenantAdmin) {
      throw new Error("Unauthorized: tenant_admin or superadmin required");
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

    const { data: targetMembership, error: targetMembershipError } = await supabaseAdmin
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (targetMembershipError || !targetMembership) {
      throw new Error("Target user not found");
    }

    if (mergedUpdates.role && !VALID_ROLES.includes(mergedUpdates.role as ValidRole)) {
      throw new Error("Invalid role");
    }

    if (mergedUpdates.role) {
      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: userId,
          role: mergedUpdates.role,
        },
        { onConflict: "user_id" },
      );
      if (roleError) {
        throw new Error(`Failed to update role: ${roleError.message}`);
      }

      const { error: membershipRoleError } = await supabaseAdmin
        .from("tenant_members")
        .update({ role: toTenantMembershipRole(mergedUpdates.role) })
        .eq("tenant_id", authContext.tenantId)
        .eq("user_id", userId);
      if (membershipRoleError) {
        throw new Error(`Failed to update tenant membership role: ${membershipRoleError.message}`);
      }
    }

    const membershipUpdates: Record<string, unknown> = {};
    if (mergedUpdates.is_active !== undefined) membershipUpdates.is_active = mergedUpdates.is_active;
    if (Object.keys(membershipUpdates).length > 0) {
      const { error: membershipUpdateError } = await supabaseAdmin
        .from("tenant_members")
        .update(membershipUpdates)
        .eq("tenant_id", authContext.tenantId)
        .eq("user_id", userId);
      if (membershipUpdateError) {
        throw new Error(`Failed to update tenant membership: ${membershipUpdateError.message}`);
      }
    }

    const profileUpdates: Record<string, unknown> = { id: userId };
    if (mergedUpdates.full_name !== undefined) profileUpdates.full_name = mergedUpdates.full_name;
    if (mergedUpdates.phone !== undefined) profileUpdates.phone = mergedUpdates.phone;
    if (mergedUpdates.is_active !== undefined) profileUpdates.is_active = mergedUpdates.is_active;
    if (mergedUpdates.email !== undefined) profileUpdates.email = mergedUpdates.email;

    if (Object.keys(profileUpdates).length > 1) {
      let { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profileUpdates, { onConflict: "id" });

      if (profileError && mergedUpdates.is_active !== undefined && /is_active/i.test(profileError.message)) {
        delete profileUpdates.is_active;
        const fallback = await supabaseAdmin.from("profiles").upsert(profileUpdates, { onConflict: "id" });
        profileError = fallback.error;
      }

      if (profileError) {
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }
    }

    if (mergedUpdates.email || mergedUpdates.password) {
      const authUpdates: { email?: string; password?: string } = {};
      if (mergedUpdates.email) authUpdates.email = mergedUpdates.email;
      if (mergedUpdates.password) authUpdates.password = mergedUpdates.password;
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (authError) {
        throw new Error(`Failed to update auth user: ${authError.message}`);
      }
    }

    const { data: updatedProfile, error: readUpdatedError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (readUpdatedError) {
      throw new Error(`Failed to read updated profile: ${readUpdatedError.message}`);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      tenant_id: targetMembership.tenant_id,
      user_id: authContext.userId,
      action: "user.updated",
      resource: "user",
      resource_id: userId,
      metadata: {
        updated_by: authContext.userId,
        updates: mergedUpdates,
      },
    });
    if (auditError) {
      console.error("Failed to write audit log:", auditError.message);
    }

    return new Response(JSON.stringify({ success: true, profile: updatedProfile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("admin-update-user error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
