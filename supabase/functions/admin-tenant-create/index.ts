import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ensureTenantOperationalState,
} from "../_shared/tenantProvision.ts";
import { sendSuperAdminTenantCreatedNotification } from "../_shared/tenantApplicationNotification.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";
import { isValidEmail, isValidPhone, sanitizeString } from "../_shared/validation.ts";

type AdminClient = ReturnType<typeof createClient>;

interface CreateTenantPayload {
  action?: string;
  tenant_name?: string;
  admin_email?: string;
  admin_phone?: string;
  password?: string;
  plan_key?: string;
}

const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
const APP_NAME = (Deno.env.get("APP_NAME") ?? "RaheDeen Inventory").trim() || "RaheDeen Inventory";
const SUPPORT_EMAIL = (Deno.env.get("SUPPORT_EMAIL") ?? "").trim();
const TEMP_PASSWORD_NOTICE = "This is your temporary password. After signing in, go to your administrator dashboard security page and set a new password of your own.";

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

const createUniqueTenantSlug = async (
  supabaseAdmin: AdminClient,
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

const findAuthUserByEmail = async (supabaseAdmin: AdminClient, email: string) => {
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

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const findContactConflicts = async (
  supabaseAdmin: AdminClient,
  args: { email?: string; phone?: string },
): Promise<{ admin_email?: string; admin_phone?: string }> => {
  const conflicts: { admin_email?: string; admin_phone?: string } = {};
  const normalizedEmail = (args.email ?? "").trim().toLowerCase();
  const normalizedPhone = normalizePhone(args.phone ?? "");

  if (normalizedEmail) {
    const existingAuth = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
    if (existingAuth) {
      conflicts.admin_email = "This email is already registered.";
    } else {
      const { data: profileRow } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (profileRow?.id) {
        conflicts.admin_email = "This email is already registered.";
      }
    }
  }

  if (normalizedPhone) {
    const { data: phoneRows, error } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .not("phone", "is", null);
    if (error) {
      throw new Error(`Failed to validate phone: ${error.message}`);
    }
    const phoneInUse = (phoneRows ?? []).some(
      (row) => normalizePhone(row.phone ?? "") === normalizedPhone,
    );
    if (phoneInUse) {
      conflicts.admin_phone = "This phone number is already registered.";
    }
  }

  return conflicts;
};

const validatePassword = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must include at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one symbol";
  return null;
};

const normalizePlanKey = (value: string | null | undefined): "free" | "starter" | "pro" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "starter" || normalized === "pro") {
    return normalized;
  }

  return "free";
};

const buildTenantVerificationRedirectUrl = (): string => {
  const url = new URL(`${APP_URL}/auth`);
  url.searchParams.set("source", "tenant-created-by-superadmin");
  url.searchParams.set("verified", "1");
  url.searchParams.set("tenant_login", "1");
  return url.toString();
};

const applyTenantBillingPlan = async (
  supabaseAdmin: AdminClient,
  tenantId: string,
  planKey: "free" | "starter" | "pro",
) => {
  const normalizedPlanKey = normalizePlanKey(planKey);
  const { data: existingBilling, error: readError } = await supabaseAdmin
    .from("tenant_billing")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to load tenant billing: ${readError.message}`);
  }

  if (existingBilling?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("tenant_billing")
      .update({
        plan_key: normalizedPlanKey,
        package_limits_enabled: true,
      })
      .eq("id", existingBilling.id);

    if (updateError) {
      throw new Error(`Failed to update tenant billing plan: ${updateError.message}`);
    }

    return normalizedPlanKey;
  }

  const { error: insertError } = await supabaseAdmin
    .from("tenant_billing")
    .insert({
      tenant_id: tenantId,
      plan_key: normalizedPlanKey,
      status: "inactive",
      package_limits_enabled: true,
    });

  if (insertError) {
    throw new Error(`Failed to create tenant billing plan: ${insertError.message}`);
  }

  return normalizedPlanKey;
};

const ensureTenantAdminProfile = async (
  supabaseAdmin: AdminClient,
  args: {
    userId: string;
    tenantId: string;
    fullName: string;
    email: string;
    phone: string;
  },
) => {
  const primaryProfile = {
    id: args.userId,
    tenant_id: args.tenantId,
    full_name: args.fullName,
    email: args.email,
    phone: args.phone,
    role: "tenant_admin",
    force_password_reset: true,
    is_active: true,
  };

  let { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(primaryProfile, { onConflict: "id" });

  if (profileError && /tenant_id|force_password_reset|is_active|phone/i.test(profileError.message)) {
    const fallbackProfile = {
      id: args.userId,
      full_name: args.fullName,
      email: args.email,
      phone: args.phone,
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

  if (roleError && /invalid input value for enum|tenant_admin|user_role/i.test(roleError.message)) {
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
      { ...RateLimitPresets.sensitive, keyPrefix: "admin-tenant-create" },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, corsHeaders);
    }

    const payload = (await req.json()) as CreateTenantPayload;
    const action = (payload.action ?? "create").toLowerCase();
    const tenantName = sanitizeString(String(payload.tenant_name ?? ""), 80);
    const adminEmail = String(payload.admin_email ?? "").trim().toLowerCase();
    const adminPhone = String(payload.admin_phone ?? "").trim();
    const password = String(payload.password ?? "");
    const planKey = normalizePlanKey(payload.plan_key);

    if (action === "validate_contact") {
      const fieldErrors = await findContactConflicts(supabaseAdmin, {
        email: adminEmail,
        phone: adminPhone,
      });

      return new Response(
        JSON.stringify({
          success: true,
          valid: Object.keys(fieldErrors).length === 0,
          field_errors: fieldErrors,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!tenantName || !adminEmail || !adminPhone || !password) {
      return new Response(JSON.stringify({ error: "tenant_name, admin_email, admin_phone, and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidEmail(adminEmail)) {
      return new Response(JSON.stringify({ error: "Invalid admin email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidPhone(adminPhone)) {
      return new Response(JSON.stringify({ error: "Invalid admin phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return new Response(JSON.stringify({ error: passwordError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldErrors = await findContactConflicts(supabaseAdmin, {
      email: adminEmail,
      phone: adminPhone,
    });
    if (fieldErrors.admin_email || fieldErrors.admin_phone) {
      return new Response(JSON.stringify({ error: "Contact already exists", field_errors: fieldErrors }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminName = `${tenantName} Admin`;
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    if (!anonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const verificationRedirectTo = buildTenantVerificationRedirectUrl();
    const { data: createdUser, error: createUserError } = await supabaseAnon.auth.signUp({
      email: adminEmail,
      password,
      options: {
        emailRedirectTo: verificationRedirectTo,
        data: {
          source: "tenant_created_by_superadmin",
          full_name: adminName,
          workspace_name: tenantName,
          role: "tenant_admin",
          created_by: reviewer.id,
          temp_password: password,
          temporary_password_message: TEMP_PASSWORD_NOTICE,
          force_password_reset: true,
          login_url: `${APP_URL}/auth`,
          reset_password_url: `${APP_URL}/reset-password?forced=true`,
          app_name: APP_NAME,
          support_email: SUPPORT_EMAIL,
        },
      },
    });

    if (createUserError || !createdUser.user) {
      throw new Error(`Failed to create tenant admin: ${createUserError?.message ?? "Unknown error"}`);
    }

    if (Array.isArray(createdUser.user.identities) && createdUser.user.identities.length === 0) {
      throw new Error("This email is already registered.");
    }

    const tenantSlug = await createUniqueTenantSlug(supabaseAdmin, tenantName);
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: tenantName,
        slug: tenantSlug,
        created_by: reviewer.id,
        is_active: true,
      })
      .select("id")
      .single();

    if (tenantError || !tenant?.id) {
      throw new Error(`Failed to create workspace: ${tenantError?.message ?? "Unknown error"}`);
    }

    const tenantId = tenant.id;
    const adminUserId = createdUser.user.id;

    await ensureTenantAdminProfile(supabaseAdmin, {
      userId: adminUserId,
      tenantId,
      fullName: adminName,
      email: adminEmail,
      phone: adminPhone,
    });

    const { error: tenantMemberError } = await supabaseAdmin
      .from("tenant_members")
      .upsert(
        {
          tenant_id: tenantId,
          user_id: adminUserId,
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

    await ensureTenantOperationalState(supabaseAdmin, {
      tenantId,
      workspaceName: tenantName,
      userId: adminUserId,
      fullName: adminName,
      email: adminEmail,
    });
    const appliedPlanKey = await applyTenantBillingPlan(supabaseAdmin, tenantId, planKey);

    const { error: metadataUpdateError } = await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
      user_metadata: {
        full_name: adminName,
        tenant_id: tenantId,
        role: "tenant_admin",
        force_password_reset: true,
      },
    });
    if (metadataUpdateError) {
      console.warn(`Failed to update tenant admin metadata: ${metadataUpdateError.message}`);
    }

    let emailSent = true;
    let emailErrorMessage: string | null = null;
    let emailErrorCode: string | null = null;
    let emailStatus: "sent" | "failed" | "skipped" = "sent";
    const emailSentAt: string | null = new Date().toISOString();

    try {
      const notificationResult = await sendSuperAdminTenantCreatedNotification({
        tenantId,
        tenantName,
        tenantAdminName: adminName,
        tenantAdminEmail: adminEmail,
        planKey: appliedPlanKey,
        createdByName: String(reviewer.user_metadata?.full_name ?? reviewer.email ?? "Super Admin"),
        createdByEmail: String(reviewer.email ?? ""),
      });
      if (notificationResult.status === "failed") {
        console.warn(
          `Superadmin tenant-created alert failed for tenant ${tenantId}: ${notificationResult.error ?? "Unknown error"}`,
        );
      }
    } catch (notificationError) {
      const notificationMessage =
        notificationError instanceof Error ? notificationError.message : "Unknown tenant-created notification error";
      console.warn(
        `Failed to send tenant-created superadmin alert for tenant ${tenantId}: ${notificationMessage}`,
      );
    }

    try {
      const { error: emailUpdateError } = await supabaseAdmin
        .from("tenants")
        .update({
          welcome_email_status: emailStatus,
          welcome_email_sent_at: emailSentAt,
          welcome_email_error: emailErrorMessage,
          welcome_email_error_code: emailErrorCode,
        })
        .eq("id", tenantId);

      if (emailUpdateError) {
        console.warn(
          `Failed to persist welcome email status for tenant ${tenantId}: ${emailUpdateError.message}`,
        );
      }
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error ? updateError.message : "Unknown email status persistence error";
      console.warn(
        `Failed to persist welcome email status for tenant ${tenantId}: ${updateMessage}`,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenantId,
        user_id: adminUserId,
        email: adminEmail,
        email_sent: emailSent,
        email_error: emailErrorMessage,
        email_error_code: emailErrorCode,
        plan_key: appliedPlanKey,
        login_url: `${Deno.env.get("APP_URL") ?? "http://localhost:3000"}/auth`,
        requires_password_reset: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("admin-tenant-create error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
