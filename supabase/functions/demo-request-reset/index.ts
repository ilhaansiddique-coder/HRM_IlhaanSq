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

interface ResetDemoRequestPayload {
  request_id?: string;
}

const normalizeRole = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "super_admin") return "superadmin";
  return normalized;
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
    if (reviewerRole !== "superadmin") {
      return new Response(JSON.stringify({ error: "Unauthorized: superadmin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rateLimit = checkRateLimit(
      getClientIdentifier(req, reviewer.id),
      { ...RateLimitPresets.sensitive, keyPrefix: "demo-request-reset" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json()) as ResetDemoRequestPayload;
    const requestId = String(payload.request_id ?? "").trim();

    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: demoRequest, error: demoRequestError } = await supabaseAdmin
      .from("demo_requests")
      .select("id, status, tenant_id, approved_user_id")
      .eq("id", requestId)
      .maybeSingle();

    if (demoRequestError || !demoRequest) {
      return new Response(JSON.stringify({ error: "Demo request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (demoRequest.status === "approved") {
      if (demoRequest.tenant_id) {
        const { error: tenantMembersError } = await supabaseAdmin
          .from("tenant_members")
          .update({
            is_active: false,
            is_default: false,
          })
          .eq("tenant_id", demoRequest.tenant_id);

        if (tenantMembersError) {
          throw new Error(`Failed to deactivate members: ${tenantMembersError.message}`);
        }

        const { error: tenantError } = await supabaseAdmin
          .from("tenants")
          .update({ is_active: false })
          .eq("id", demoRequest.tenant_id);

        if (tenantError) {
          throw new Error(`Failed to deactivate admin: ${tenantError.message}`);
        }
      }

      if (demoRequest.approved_user_id) {
        let { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            tenant_id: null,
            is_active: false,
          })
          .eq("id", demoRequest.approved_user_id);

        if (profileError && /tenant_id|is_active/i.test(profileError.message)) {
          const fallbackProfileUpdate = await supabaseAdmin
            .from("profiles")
            .update({
              tenant_id: null,
            })
            .eq("id", demoRequest.approved_user_id);

          profileError = fallbackProfileUpdate.error;
        }

        if (profileError && !/tenant_id|is_active/i.test(profileError.message)) {
          throw new Error(`Failed to update approved admin profile: ${profileError.message}`);
        }
      }
    }

    const { error: requestUpdateError } = await supabaseAdmin
      .from("demo_requests")
      .update({
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        approval_email_sent_at: null,
      })
      .eq("id", demoRequest.id);

    if (requestUpdateError) {
      throw new Error(`Failed to reset demo request: ${requestUpdateError.message}`);
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: demoRequest.tenant_id,
        user_id: reviewer.id,
        action: "tenant.demo_request_reset",
        resource: "demo_request",
        resource_id: demoRequest.id,
        metadata: {
          demo_request_id: demoRequest.id,
          previous_status: demoRequest.status,
          approved_user_id: demoRequest.approved_user_id,
          tenant_id: demoRequest.tenant_id,
        },
      });
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : "Unknown audit insert error";
      console.warn(`Skipping reset audit log for ${demoRequest.id}: ${auditMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: demoRequest.id,
        previous_status: demoRequest.status,
        status: "pending",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("demo-request-reset error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
