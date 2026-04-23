import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";

type AdminClient = ReturnType<typeof createClient>;

interface UpdateTenantPackagePayload {
  tenant_id?: string;
  plan_key?: string;
}

const normalizeRole = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "super_admin") return "superadmin";
  if (normalized === "admin") return "tenant_admin";
  return normalized;
};

const isSuperAdminRole = (value: string | null | undefined): boolean =>
  normalizeRole(value) === "superadmin";

const normalizePlanKey = (value: string | null | undefined): "free" | "starter" | "pro" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "starter" || normalized === "pro") {
    return normalized;
  }

  return "free";
};

const resolveReviewerRole = async (
  supabaseAdmin: AdminClient,
  userId: string,
): Promise<string | null> => {
  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!roleError && roleRow?.role) {
    return normalizeRole(roleRow.role);
  }

  const { data: profileRoleRow, error: profileRoleError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!profileRoleError && profileRoleRow?.role) {
    return normalizeRole(profileRoleRow.role);
  }

  return null;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Server configuration is incomplete");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user: reviewer },
      error: reviewerError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (reviewerError || !reviewer) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewerRole = await resolveReviewerRole(supabaseAdmin, reviewer.id);
    if (!isSuperAdminRole(reviewerRole)) {
      return new Response(JSON.stringify({ error: "Unauthorized: superadmin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = checkRateLimit(
      getClientIdentifier(req, reviewer.id),
      { ...RateLimitPresets.sensitive, keyPrefix: "admin-tenant-package-update" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json()) as UpdateTenantPackagePayload;
    const tenantId = String(payload.tenant_id ?? "").trim();
    const planKey = normalizePlanKey(payload.plan_key);

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantRow, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .limit(1)
      .maybeSingle();

    if (tenantError) {
      throw new Error(`Failed to validate tenant: ${tenantError.message}`);
    }

    if (!tenantRow?.id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingBilling, error: billingReadError } = await supabaseAdmin
      .from("tenant_billing")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (billingReadError) {
      throw new Error(`Failed to load tenant billing: ${billingReadError.message}`);
    }

    if (existingBilling?.id) {
      const { error: billingUpdateError } = await supabaseAdmin
        .from("tenant_billing")
        .update({
          plan_key: planKey,
          package_limits_enabled: true,
        })
        .eq("id", existingBilling.id);

      if (billingUpdateError) {
        throw new Error(`Failed to update tenant billing plan: ${billingUpdateError.message}`);
      }
    } else {
      const { error: billingInsertError } = await supabaseAdmin
        .from("tenant_billing")
        .insert({
          tenant_id: tenantId,
          plan_key: planKey,
          status: "inactive",
          package_limits_enabled: true,
        });

      if (billingInsertError) {
        throw new Error(`Failed to create tenant billing plan: ${billingInsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenantId,
        plan_key: planKey,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("admin-tenant-package-update error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
