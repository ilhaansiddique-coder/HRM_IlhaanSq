import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";
import { verifyOptionalRequestSignature } from "../_shared/requestSignature.ts";
import { isValidUUID, parseAndValidateBody, sanitizeString } from "../_shared/validation.ts";

interface InviteDetailsBody {
  token?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.standard, keyPrefix: "tenant-invite-details" },
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, corsHeaders);
  }

  try {
    let token = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token") ?? url.searchParams.get("invite") ?? "";
    } else {
      const rawBody = await req.text();
      const signatureCheck = await verifyOptionalRequestSignature(req, rawBody, {
        secretEnvKey: "PUBLIC_ENDPOINT_SIGNING_SECRET",
        maxSkewSeconds: 300,
      });
      if (!signatureCheck.ok) {
        return new Response(JSON.stringify({ success: false, error: signatureCheck.error }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let parsedBody: InviteDetailsBody;
      try {
        parsedBody = rawBody.trim() ? JSON.parse(rawBody) as InviteDetailsBody : {};
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = await parseAndValidateBody<InviteDetailsBody>(
        new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(parsedBody),
        }),
        ["token"],
      );
      if (!parsed.success) {
        return new Response(JSON.stringify({ success: false, error: parsed.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      token = String(parsed.data.token ?? "");
    }

    token = sanitizeString(token, 100);
    if (!isValidUUID(token)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid invite token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("tenant_invites")
      .select("email, role, expires_at, accepted_at, created_at, tenant_id")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ success: false, error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", invite.tenant_id)
      .maybeSingle();

    const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
    const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;

    return new Response(
      JSON.stringify({
        success: true,
        invite: {
          email: invite.email,
          role: invite.role,
          created_at: invite.created_at,
          expires_at: invite.expires_at,
          accepted_at: invite.accepted_at,
          tenant_name: tenant?.name ?? "Workspace",
          is_expired: isExpired,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
