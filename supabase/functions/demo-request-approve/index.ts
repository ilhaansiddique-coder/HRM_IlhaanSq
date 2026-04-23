import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ensureTenantOperationalState,
} from "../_shared/tenantProvision.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";

type AdminClient = ReturnType<typeof createClient>;
type RequestedPackage = "starter" | "professional" | "enterprise";
type ApprovedPlanKey = "free" | "starter" | "pro";

interface ApproveDemoRequestPayload {
  request_id?: string;
  review_notes?: string;
  initial_password?: string;
}

interface TenantAccessEmailMetadataArgs {
  requestId: string;
  fullName: string;
  workspaceName: string;
  tempPassword: string;
  requestedPackage: RequestedPackage;
  approvedPlanKey: ApprovedPlanKey;
  tenantId?: string | null;
}

interface TenantAuthAccessResult {
  userId: string;
  approvalEmailSent: boolean;
  requiresEmailVerification: boolean;
}

const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
const APP_NAME = (Deno.env.get("APP_NAME") ?? "RaheDeen Inventory").trim() || "RaheDeen Inventory";
const SUPPORT_EMAIL = (Deno.env.get("SUPPORT_EMAIL") ?? "").trim();
const TEMP_PASSWORD_NOTICE = "This is your temporary password. After signing in, go to your administrator dashboard security page and set a new password of your own.";

const normalizeRequestedPackage = (value: string | null | undefined): RequestedPackage => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "professional") return "professional";
  if (normalized === "enterprise") return "enterprise";
  return "starter";
};

const mapRequestedPackageToPlanKey = (requestedPackage: RequestedPackage): ApprovedPlanKey => {
  switch (requestedPackage) {
    case "professional":
      return "starter";
    case "enterprise":
      return "pro";
    default:
      return "free";
  }
};

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

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const generateTempPassword = (length = 12): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
};

const createUniqueTenantSlug = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  baseValue: string,
): Promise<string> => {
  const baseSlug = slugify(baseValue) || `workspace-${crypto.randomUUID().slice(0, 8)}`;
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: existing, error } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check workspace slug: ${error.message}`);
    }

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  return `${baseSlug}-${Date.now()}`;
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) => {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to search existing auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const matchedUser = users.find((user) => (user.email ?? "").toLowerCase() === normalizedEmail);
    if (matchedUser) {
      return matchedUser;
    }

    if (users.length < 200) {
      break;
    }
  }

  return null;
};

const normalizeUserMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const buildTenantAccessRedirectUrl = (): string => {
  const url = new URL(`${APP_URL}/auth`);
  url.searchParams.set("source", "tenant-access-approved");
  url.searchParams.set("verified", "1");
  url.searchParams.set("tenant_login", "1");
  return url.toString();
};

const buildTenantAccessEmailMetadata = (
  existingMetadata: unknown,
  args: TenantAccessEmailMetadataArgs,
): Record<string, unknown> => {
  const baseMetadata = normalizeUserMetadata(existingMetadata);
  const nextMetadata: Record<string, unknown> = {
    ...baseMetadata,
    source: "tenant_access_approved",
    full_name: args.fullName,
    approved_demo_request_id: args.requestId,
    workspace_name: args.workspaceName,
    role: "tenant_admin",
    app_name: APP_NAME,
    support_email: SUPPORT_EMAIL,
    login_url: `${APP_URL}/auth`,
    reset_password_url: `${APP_URL}/reset-password?forced=true`,
    temp_password: args.tempPassword,
    temporary_password_message: TEMP_PASSWORD_NOTICE,
    force_password_reset: true,
    requested_package: args.requestedPackage,
    requested_plan_key: args.approvedPlanKey,
  };

  if (args.tenantId) {
    nextMetadata.tenant_id = args.tenantId;
  }

  return nextMetadata;
};

const isDuplicateAuthError = (value: string): boolean =>
  /already.*registered|already exists|already in use|duplicate|email address has already/i.test(value);

const ensureTenantAdminProfile = async (
  supabaseAdmin: AdminClient,
  args: {
    userId: string;
    tenantId: string;
    fullName: string;
    email: string;
  },
) => {
  const primaryProfile = {
    id: args.userId,
    tenant_id: args.tenantId,
    full_name: args.fullName,
    email: args.email,
    role: "tenant_admin",
    force_password_reset: true,
    is_active: true,
  };

  let { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(primaryProfile, { onConflict: "id" });

  if (profileError && /tenant_id|force_password_reset|is_active/i.test(profileError.message)) {
    const fallbackProfile = {
      id: args.userId,
      full_name: args.fullName,
      email: args.email,
      role: "tenant_admin",
    };
    const fallback = await supabaseAdmin
      .from("profiles")
      .upsert(fallbackProfile, { onConflict: "id" });
    profileError = fallback.error;
  }

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  let { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        user_id: args.userId,
        role: "tenant_admin",
      },
      { onConflict: "user_id" },
    );

  if (
    roleError &&
    /invalid input value for enum|tenant_admin|user_role/i.test(roleError.message)
  ) {
    const fallback = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: args.userId,
          role: "admin",
        },
        { onConflict: "user_id" },
      );
    roleError = fallback.error;
  }

  if (roleError) {
    throw new Error(`Failed to assign tenant admin role: ${roleError.message}`);
  }
};

const sendTenantAccessEmail = async (args: {
  email: string;
  metadata: Record<string, unknown>;
}) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    console.warn("Skipped tenant access email: SUPABASE_ANON_KEY is not configured.");
    return false;
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabaseAnon.auth.signInWithOtp({
    email: args.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: buildTenantAccessRedirectUrl(),
      data: args.metadata,
    },
  });

  if (error) {
    console.error(`Supabase tenant access email failed: ${error.message}`);
    return false;
  }

  return true;
};

const createOrRefreshTenantAdminAuthAccess = async (
  supabaseAdmin: AdminClient,
  args: {
    email: string;
    tempPassword: string;
    emailMetadata: Record<string, unknown>;
  },
): Promise<TenantAuthAccessResult> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_ANON_KEY is not configured");
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const refreshExistingUser = async (
    existingAuthUser: {
      id: string;
      email_confirmed_at?: string | null;
      user_metadata?: unknown;
    },
  ): Promise<TenantAuthAccessResult> => {
    const mergedMetadata = buildTenantAccessEmailMetadata(existingAuthUser.user_metadata, {
      requestId: String(args.emailMetadata.approved_demo_request_id ?? ""),
      fullName: String(args.emailMetadata.full_name ?? ""),
      workspaceName: String(args.emailMetadata.workspace_name ?? ""),
      tempPassword: args.tempPassword,
      requestedPackage: String(args.emailMetadata.requested_package ?? "starter") as RequestedPackage,
      approvedPlanKey: String(args.emailMetadata.requested_plan_key ?? "free") as ApprovedPlanKey,
      tenantId: String(args.emailMetadata.tenant_id ?? "").trim() || null,
    });

    const { data: updatedUser, error: updateExistingUserError } =
      await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password: args.tempPassword,
          user_metadata: mergedMetadata,
        },
      );

    if (updateExistingUserError || !updatedUser.user) {
      throw new Error(
        `Failed to prepare existing tenant admin user: ${updateExistingUserError?.message ?? "Unknown error"}`,
      );
    }

    if (existingAuthUser.email_confirmed_at) {
      const approvalEmailSent = await sendTenantAccessEmail({
        email: args.email,
        metadata: mergedMetadata,
      });
      return {
        userId: existingAuthUser.id,
        approvalEmailSent,
        requiresEmailVerification: false,
      };
    }

    const { error: resendError } = await supabaseAnon.auth.resend({
      type: "signup",
      email: args.email,
      options: {
        emailRedirectTo: buildTenantAccessRedirectUrl(),
      },
    });

    if (resendError) {
      throw new Error(`Failed to send tenant verification email: ${resendError.message}`);
    }

    return {
      userId: existingAuthUser.id,
      approvalEmailSent: true,
      requiresEmailVerification: true,
    };
  };

  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, args.email);
  if (existingAuthUser) {
    return refreshExistingUser(existingAuthUser);
  }

  const { data: signupData, error: signupError } = await supabaseAnon.auth.signUp({
    email: args.email,
    password: args.tempPassword,
    options: {
      emailRedirectTo: buildTenantAccessRedirectUrl(),
      data: args.emailMetadata,
    },
  });

  const returnedExistingUser = Boolean(
    signupData?.user &&
    Array.isArray(signupData.user.identities) &&
    signupData.user.identities.length === 0,
  );

  if (signupError || !signupData.user || returnedExistingUser) {
    const signupMessage =
      signupError?.message ?? (returnedExistingUser ? "User already registered" : "Failed to create account");

    if (!returnedExistingUser && !isDuplicateAuthError(signupMessage)) {
      throw new Error(`Failed to create tenant admin: ${signupMessage}`);
    }

    const duplicateUser = await findAuthUserByEmail(supabaseAdmin, args.email);
    if (!duplicateUser) {
      throw new Error(`Tenant admin email already exists in auth but could not be located: ${args.email}`);
    }

    return refreshExistingUser(duplicateUser);
  }

  return {
    userId: signupData.user.id,
    approvalEmailSent: true,
    requiresEmailVerification: !signupData.user.email_confirmed_at,
  };
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
      { ...RateLimitPresets.sensitive, keyPrefix: "demo-request-approve" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json()) as ApproveDemoRequestPayload;
    const requestId = String(payload.request_id ?? "").trim();
    const reviewNotes = String(payload.review_notes ?? "").trim() || null;
    const requestedInitialPassword = String(payload.initial_password ?? "").trim();

    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestedInitialPassword && requestedInitialPassword.length < 8) {
      return new Response(JSON.stringify({ error: "initial_password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: demoRequest, error: demoRequestError } = await supabaseAdmin
      .from("demo_requests")
      .select(
        "id, tenant_id, approved_user_id, full_name, business_name, email, phone, business_type, message, status, requested_domain, requested_package",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (demoRequestError || !demoRequest) {
      return new Response(JSON.stringify({ error: "Demo request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (demoRequest.status === "approved") {
      return new Response(
        JSON.stringify({
          error: "Demo request is already approved",
          tenant_id: demoRequest.tenant_id,
          user_id: demoRequest.approved_user_id,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tempPassword = requestedInitialPassword || generateTempPassword();
    const requestedPackage = normalizeRequestedPackage(demoRequest.requested_package);
    const approvedPlanKey = mapRequestedPackageToPlanKey(requestedPackage);
    const baseTenantAccessMetadata = buildTenantAccessEmailMetadata(null, {
      requestId: demoRequest.id,
      fullName: demoRequest.full_name,
      workspaceName: demoRequest.business_name,
      tempPassword,
      requestedPackage,
      approvedPlanKey,
    });
    const authAccess = await createOrRefreshTenantAdminAuthAccess(supabaseAdmin, {
      email: demoRequest.email,
      tempPassword,
      emailMetadata: baseTenantAccessMetadata,
    });

    let approvedUserId = authAccess.userId;
    let tenantId = demoRequest.tenant_id ?? null;

    if (tenantId) {
      const { data: existingTenant, error: existingTenantError } = await supabaseAdmin
        .from("tenants")
        .update({
          name: demoRequest.business_name,
          is_active: true,
        })
        .eq("id", tenantId)
        .select("id")
        .maybeSingle();

      if (existingTenantError || !existingTenant?.id) {
        tenantId = null;
      }
    }

    if (!tenantId) {
      const tenantSlugBase = String(demoRequest.requested_domain || demoRequest.business_name || demoRequest.full_name);
      const slug = await createUniqueTenantSlug(supabaseAdmin, tenantSlugBase);
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: demoRequest.business_name,
          slug,
          created_by: approvedUserId,
          is_active: true,
        })
        .select("id")
        .single();

      if (tenantError || !tenant?.id) {
        throw new Error(`Failed to create workspace: ${tenantError?.message ?? "Unknown error"}`);
      }

      tenantId = tenant.id;
    }

    const { error: deactivateMembershipsError } = await supabaseAdmin
      .from("tenant_members")
      .update({
        is_default: false,
        is_active: false,
      })
      .eq("user_id", approvedUserId)
      .neq("tenant_id", tenantId);

    if (deactivateMembershipsError) {
      throw new Error(`Failed to update previous tenant memberships: ${deactivateMembershipsError.message}`);
    }

    const { error: tenantMemberError } = await supabaseAdmin
      .from("tenant_members")
      .upsert(
        {
          tenant_id: tenantId,
          user_id: approvedUserId,
          role: "owner",
          is_default: true,
          is_active: true,
          invited_by: reviewer.id,
        },
        { onConflict: "tenant_id,user_id" },
      );

    if (tenantMemberError) {
      throw new Error(`Failed to assign tenant membership: ${tenantMemberError.message}`);
    }

    await ensureTenantAdminProfile(supabaseAdmin, {
      userId: approvedUserId,
      tenantId,
      fullName: demoRequest.full_name,
      email: demoRequest.email,
    });

    await ensureTenantOperationalState(supabaseAdmin, {
      tenantId,
      workspaceName: demoRequest.business_name,
      userId: approvedUserId,
      fullName: demoRequest.full_name,
      email: demoRequest.email,
    });

    const { data: billingRow, error: billingReadError } = await supabaseAdmin
      .from("tenant_billing")
      .select("id, plan_key, status, stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (billingReadError) {
      throw new Error(`Failed to read tenant billing: ${billingReadError.message}`);
    }

    const hasManagedPaidBilling =
      !!billingRow?.stripe_subscription_id ||
      billingRow?.status === "active" ||
      billingRow?.status === "trialing";

    if (!hasManagedPaidBilling) {
      const billingMutation = billingRow?.id
        ? await supabaseAdmin
            .from("tenant_billing")
            .update({
              plan_key: approvedPlanKey,
              package_limits_enabled: true,
            })
            .eq("id", billingRow.id)
        : await supabaseAdmin
            .from("tenant_billing")
            .insert({
              tenant_id: tenantId,
              plan_key: approvedPlanKey,
              package_limits_enabled: true,
              status: "inactive",
            });

      if (billingMutation.error) {
        throw new Error(`Failed to stamp tenant billing plan: ${billingMutation.error.message}`);
      }
    }

    const finalTenantAccessMetadata = buildTenantAccessEmailMetadata(baseTenantAccessMetadata, {
      requestId: demoRequest.id,
      fullName: demoRequest.full_name,
      workspaceName: demoRequest.business_name,
      tempPassword,
      requestedPackage,
      approvedPlanKey,
      tenantId,
    });
    const { error: metadataUpdateError } = await supabaseAdmin.auth.admin.updateUserById(approvedUserId, {
      user_metadata: finalTenantAccessMetadata,
    });
    if (metadataUpdateError) {
      console.warn(`Failed to update tenant admin metadata: ${metadataUpdateError.message}`);
    }

    const approvalEmailSent = authAccess.approvalEmailSent;

    const { error: requestUpdateError } = await supabaseAdmin
      .from("demo_requests")
      .update({
        status: "approved",
        tenant_id: tenantId,
        approved_user_id: approvedUserId,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
        approval_email_sent_at: approvalEmailSent ? new Date().toISOString() : null,
      })
      .eq("id", demoRequest.id);

    if (requestUpdateError) {
      throw new Error(`Failed to update demo request: ${requestUpdateError.message}`);
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: reviewer.id,
        action: "tenant.demo_request_approved",
        resource: "demo_request",
        resource_id: demoRequest.id,
        metadata: {
          demo_request_id: demoRequest.id,
          approved_user_id: approvedUserId,
          approved_email: demoRequest.email,
          tenant_id: tenantId,
          requested_package: requestedPackage,
          approved_plan_key: approvedPlanKey,
        },
      });
    } catch (auditError) {
      const auditMessage = auditError instanceof Error ? auditError.message : "Unknown audit insert error";
      console.warn(`Skipping audit log write for approval ${demoRequest.id}: ${auditMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: demoRequest.id,
        tenant_id: tenantId,
        user_id: approvedUserId,
        email: demoRequest.email,
        temp_password: tempPassword,
        login_url: `${APP_URL}/auth`,
        approval_email_sent: approvalEmailSent,
        requires_email_verification: authAccess.requiresEmailVerification,
        requested_package: requestedPackage,
        approved_plan_key: approvedPlanKey,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("demo-request-approve error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
