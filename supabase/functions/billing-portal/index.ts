import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ensureRolePermission,
  extractAccessToken,
  resolveTenantAuthContext,
} from "../_shared/authTenant.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.sensitive, keyPrefix: "billing-portal" },
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, corsHeaders);
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured");
    }

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
    const body = await req.json();
    const requestedTenantId = String(body?.tenantId ?? body?.tenant_id ?? "").trim() || null;
    const authContext = await resolveTenantAuthContext(supabaseAdmin, accessToken, requestedTenantId);
    const canManageBilling = await ensureRolePermission(
      supabaseAdmin,
      authContext.role,
      "billing.edit",
      authContext.tenantId,
    );
    if (!canManageBilling) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized: billing.edit permission required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: billing, error: billingError } = await supabaseAdmin
      .from("tenant_billing")
      .select("stripe_customer_id")
      .eq("tenant_id", authContext.tenantId)
      .maybeSingle();

    if (billingError || !billing?.stripe_customer_id) {
      return new Response(JSON.stringify({ success: false, error: "No billing customer found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const returnUrl = String(body?.return_url ?? `${APP_URL}/admin?tab=billing`);

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ success: true, url: session.url }), {
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
