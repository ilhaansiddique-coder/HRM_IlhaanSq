import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { extractAccessToken, resolveTenantAuthContext } from "../_shared/authTenant.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";

type SteadfastProxyBody = {
  consignment_id?: string;
  api_key?: string;
  secret_key?: string;
};

const jsonHeaders = (corsHeaders: Record<string, string>) => ({
  ...corsHeaders,
  "Content-Type": "application/json",
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders(corsHeaders),
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authContext = await resolveTenantAuthContext(supabase, accessToken);
    const rateLimit = checkRateLimit(
      getClientIdentifier(req, authContext.userId),
      { ...RateLimitPresets.standard, keyPrefix: "steadfast-proxy" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const body = (await req.json().catch(() => null)) as SteadfastProxyBody | null;
    if (!body) {
      return new Response(JSON.stringify({ success: false, message: "Invalid JSON in request body" }), {
        status: 400,
        headers: jsonHeaders(corsHeaders),
      });
    }

    const consignmentId = String(body.consignment_id ?? "").trim();
    if (!consignmentId) {
      return new Response(JSON.stringify({ success: false, message: "Missing consignment_id" }), {
        status: 400,
        headers: jsonHeaders(corsHeaders),
      });
    }

    const [saleByConsignment, saleByCn] = await Promise.all([
      supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("consignment_id", consignmentId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("cn_number", consignmentId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!saleByConsignment.data && !saleByCn.data) {
      return new Response(JSON.stringify({
        success: false,
        message: "Consignment not found for your tenant",
      }), {
        status: 404,
        headers: jsonHeaders(corsHeaders),
      });
    }

    let apiKey = String(body.api_key ?? "").trim();
    let secretKey = String(body.secret_key ?? "").trim();

    if (!apiKey || !secretKey) {
      const { data: settings } = await supabase
        .from("courier_webhook_settings")
        .select("steadfast_api_key, steadfast_secret_key")
        .eq("tenant_id", authContext.tenantId)
        .limit(1)
        .maybeSingle();

      apiKey = String(settings?.steadfast_api_key ?? "").trim();
      secretKey = String(settings?.steadfast_secret_key ?? "").trim();
    }

    if (!apiKey || !secretKey) {
      return new Response(JSON.stringify({
        success: false,
        message: "Steadfast API credentials are not configured",
      }), {
        status: 400,
        headers: jsonHeaders(corsHeaders),
      });
    }

    const steadfastResponse = await fetch(
      `https://portal.packzy.com/api/v1/status_by_cid/${encodeURIComponent(consignmentId)}`,
      {
        method: "GET",
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
      },
    );

    const responseText = await steadfastResponse.text();
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid response from Steadfast API",
      }), {
        status: 502,
        headers: jsonHeaders(corsHeaders),
      });
    }

    const deliveryStatus = (parsedResponse as { delivery_status?: string } | null)?.delivery_status ?? null;
    return new Response(JSON.stringify({
      success: steadfastResponse.ok,
      data: parsedResponse,
      delivery_status: deliveryStatus,
    }), {
      status: steadfastResponse.ok ? 200 : 502,
      headers: jsonHeaders(corsHeaders),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: jsonHeaders(corsHeaders),
    });
  }
});
