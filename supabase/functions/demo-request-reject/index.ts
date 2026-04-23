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

interface RejectDemoRequestPayload {
  request_id?: string;
  review_notes?: string;
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
      { ...RateLimitPresets.sensitive, keyPrefix: "demo-request-reject" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json()) as RejectDemoRequestPayload;
    const requestId = String(payload.request_id ?? "").trim();
    const reviewNotes = String(payload.review_notes ?? "").trim() || null;

    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: demoRequest, error: demoRequestError } = await supabaseAdmin
      .from("demo_requests")
      .select(
        "id, tenant_id, full_name, business_name, email, phone, status, request_notification_status",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (demoRequestError || !demoRequest) {
      return new Response(JSON.stringify({ error: "Demo request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (demoRequest.status !== "pending") {
      return new Response(JSON.stringify({ error: "Only pending requests can be rejected" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("demo_requests")
      .delete()
      .eq("id", demoRequest.id);

    if (deleteError) {
      throw new Error(`Failed to delete demo request: ${deleteError.message}`);
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: demoRequest.tenant_id,
        user_id: reviewer.id,
        action: "tenant.demo_request_rejected",
        resource: "demo_request",
        resource_id: null,
        metadata: {
          demo_request_id: demoRequest.id,
          full_name: demoRequest.full_name,
          business_name: demoRequest.business_name,
          email: demoRequest.email,
          phone: demoRequest.phone,
          request_notification_status: demoRequest.request_notification_status,
          review_notes: reviewNotes,
        },
      });
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : "Unknown audit insert error";
      console.warn(`Skipping reject audit log for ${demoRequest.id}: ${auditMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: demoRequest.id,
        status: "rejected",
        deleted: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("demo-request-reject error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
