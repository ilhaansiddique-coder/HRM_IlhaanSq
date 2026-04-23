import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
} from "../_shared/rateLimiter.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const priceIdToPlanKey = (): Record<string, string> => {
  const starter = Deno.env.get("STRIPE_PRICE_STARTER") ?? "";
  const pro = Deno.env.get("STRIPE_PRICE_PRO") ?? "";
  return {
    [starter]: "starter",
    [pro]: "pro",
  };
};

const getPlanKeyFromPrice = (priceId?: string | null) => {
  if (!priceId) return "free";
  return priceIdToPlanKey()[priceId] ?? "free";
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.webhook, keyPrefix: "stripe-webhook" },
  );
  if (!rateLimit.allowed) {
    return new Response("Rate limit exceeded", { status: 429 });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const updateBillingByCustomer = async (
    customerId: string,
    updates: Record<string, unknown>,
  ) => {
    const { error } = await supabaseAdmin
      .from("tenant_billing")
      .update(updates)
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Failed to update tenant billing:", error.message);
    }
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
    const planKey = session.metadata?.plan_key ?? "starter";

    if (customerId) {
      await updateBillingByCustomer(customerId, {
        stripe_subscription_id: subscriptionId ?? null,
        plan_key: planKey,
        package_limits_enabled: true,
        status: "active",
      });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const planKey = getPlanKeyFromPrice(priceId);

    if (customerId) {
      await updateBillingByCustomer(customerId, {
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        plan_key: planKey,
        package_limits_enabled: true,
        status: subscription.status,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    if (customerId) {
      await updateBillingByCustomer(customerId, {
        stripe_subscription_id: subscription.id,
        status: "canceled",
        plan_key: "free",
        package_limits_enabled: true,
        current_period_end: null,
        cancel_at_period_end: false,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
