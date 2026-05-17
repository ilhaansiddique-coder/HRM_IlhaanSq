import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  ensureRolePermission,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";
serve(async (req)=>{
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({
        error: "Server is missing service role key"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabaseAdmin = createServiceClient();
    const token = extractAccessToken(req) ?? "";
    if (!token) {
      return new Response(JSON.stringify({
        error: "Missing access token"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const body = await req.json();
    const requestedTenantId = String(body?.tenantId ?? body?.tenant_id ?? "").trim() || null;
    const authContext = await resolveTenantAuthContext(supabaseAdmin, token, requestedTenantId);
    const callerRole = authContext.role ?? "";
    const isSuperAdmin = callerRole === "superadmin";
    const isTenantAdmin = callerRole === "tenant_admin" || callerRole === "admin";
    if (!isSuperAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({
        error: "Unauthorized: Admin access required"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
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
        return new Response(JSON.stringify({
          error: "Unauthorized: admin.manage_roles permission required"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    const userId = body?.userId;
    if (!userId) {
      return new Response(JSON.stringify({
        error: "Missing userId"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (userId === authContext.userId) {
      return new Response(JSON.stringify({
        error: "You cannot delete your own account"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: targetMembership, error: membershipError } = await supabaseAdmin.from("tenant_members").select("id").eq("tenant_id", authContext.tenantId).eq("user_id", userId).maybeSingle();
    if (membershipError || !targetMembership) {
      return new Response(JSON.stringify({
        error: "User not found in your tenant"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { error: tenantDeleteError } = await supabaseAdmin.from("tenant_members").delete().eq("tenant_id", authContext.tenantId).eq("user_id", userId);
    if (tenantDeleteError) {
      return new Response(JSON.stringify({
        error: `Failed to remove tenant membership: ${tenantDeleteError.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { count: remainingMemberships, error: remainingError } = await supabaseAdmin.from("tenant_members").select("id", {
      count: "exact",
      head: true
    }).eq("user_id", userId).eq("is_active", true);
    if (!remainingError && (remainingMemberships ?? 0) === 0) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        console.error("Auth delete error after membership cleanup:", deleteAuthError);
      } else {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      removed_from_tenant_id: authContext.tenantId
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
