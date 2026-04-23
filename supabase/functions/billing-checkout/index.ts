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

const planToPriceId = (): Record<string, string> => ({
  starter: Deno.env.get("STRIPE_PRICE_STARTER") ?? "",
  pro: Deno.env.get("STRIPE_PRICE_PRO") ?? "",
});

const getBillingRow = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
) => {
  const { data, error } = await supabaseAdmin
    .from("tenant_billing")
    .select("id, stripe_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read billing record: ${error.message}`);
  }

  if (data) return data;

  const { data: created, error: createError } = await supabaseAdmin
    .from("tenant_billing")
    .insert({
      tenant_id: tenantId,
      plan_key: "free",
      status: "inactive",
    })
    .select("id, stripe_customer_id")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create billing record: ${createError?.message ?? "Unknown error"}`);
  }

  return created;
};

const ensureStripeCustomer = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  user: { id: string; email?: string | null; full_name?: string | null },
) => {
  const billing = await getBillingRow(supabaseAdmin, tenantId);

  if (billing.stripe_customer_id) {
    return billing.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.full_name ?? undefined,
    metadata: {
      tenant_id: tenantId,
      user_id: user.id,
    },
  });

  const { error: updateError } = await supabaseAdmin
    .from("tenant_billing")
    .update({ stripe_customer_id: customer.id })
    .eq("id", billing.id);

  if (updateError) {
    throw new Error(`Failed to update billing customer: ${updateError.message}`);
  }

  return customer.id;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.sensitive, keyPrefix: "billing-checkout" },
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

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planKey = String(body?.plan_key ?? "").trim();
    const priceId = planToPriceId()[planKey];
    if (!priceId) {
      return new Response(JSON.stringify({ success: false, error: "Invalid plan selection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const successUrl = String(body?.success_url ?? `${APP_URL}/admin?tab=billing&status=success`);
    const cancelUrl = String(body?.cancel_url ?? `${APP_URL}/admin?tab=billing&status=cancel`);

    const customerId = await ensureStripeCustomer(
      supabaseAdmin,
      authContext.tenantId,
      {
        id: userData.user.id,
        email: userData.user.email,
        full_name: String(userData.user.user_metadata?.full_name ?? ""),
      },
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: authContext.tenantId,
        user_id: userData.user.id,
        plan_key: planKey,
      },
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
