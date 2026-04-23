import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  persistTenantApplicationNotificationResult,
  sendTenantApplicationNotification,
} from "../_shared/tenantApplicationNotification.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";

type AdminClient = ReturnType<typeof createClient>;

interface RetryTenantRequestNotificationsPayload {
  limit?: number;
}

interface DemoRequestNotificationRow {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  requested_domain: string | null;
  business_type: string;
  message: string | null;
  request_notification_status: "pending" | "sent" | "failed" | "skipped";
  request_notification_sent_at: string | null;
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
      { ...RateLimitPresets.sensitive, keyPrefix: "demo-request-notification-retry" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json().catch(() => ({}))) as RetryTenantRequestNotificationsPayload;
    const rawLimit = Number(payload.limit ?? 0);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.trunc(rawLimit), 500)
      : null;

    const { data: pendingRequests, error: readError } = await supabaseAdmin
      .from("demo_requests")
      .select(
        "id, full_name, business_name, email, phone, requested_domain, business_type, message, request_notification_status, request_notification_sent_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (readError) {
      throw new Error(`Failed to load pending tenant requests: ${readError.message}`);
    }

    const candidates = ((pendingRequests ?? []) as DemoRequestNotificationRow[])
      .filter(
        (request) =>
          request.request_notification_status !== "sent" || !request.request_notification_sent_at,
      )
      .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

    const results: Array<{
      request_id: string;
      business_name: string;
      email: string;
      notification_status: string;
      error: string | null;
    }> = [];

    for (const request of candidates) {
      const notificationResult = await sendTenantApplicationNotification({
        requestId: request.id,
        fullName: request.full_name,
        businessName: request.business_name,
        email: request.email,
        phone: request.phone,
        requestedDomain: request.requested_domain || "Not provided",
        businessType: request.business_type,
        message: request.message || "",
        sendApplicantVerification: false,
      });

      await persistTenantApplicationNotificationResult(
        supabaseAdmin,
        request.id,
        notificationResult,
      );

      results.push({
        request_id: request.id,
        business_name: request.business_name,
        email: request.email,
        notification_status: notificationResult.status,
        error: notificationResult.error,
      });
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: null,
        user_id: reviewer.id,
        action: "tenant.demo_request_notification_retry",
        resource: "demo_request",
        resource_id: null,
        metadata: {
          attempted_count: results.length,
          sent_count: results.filter((result) => result.notification_status === "sent").length,
          failed_count: results.filter((result) => result.notification_status === "failed").length,
          skipped_count: results.filter((result) => result.notification_status === "skipped").length,
        },
      });
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : "Unknown audit insert error";
      console.warn(`Skipping notification retry audit log: ${auditMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        attempted_count: results.length,
        sent_count: results.filter((result) => result.notification_status === "sent").length,
        failed_count: results.filter((result) => result.notification_status === "failed").length,
        skipped_count: results.filter((result) => result.notification_status === "skipped").length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("demo-request-notification-retry error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
