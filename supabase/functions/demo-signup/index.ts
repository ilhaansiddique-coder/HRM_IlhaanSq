import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ensureTenantOperationalState,
} from "../_shared/tenantProvision.ts";
import {
  NotificationDeliveryResult,
  persistTenantApplicationNotificationResult,
  sendTenantApplicationNotification,
} from "../_shared/tenantApplicationNotification.ts";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitPresets,
  rateLimitExceededResponse,
} from "../_shared/rateLimiter.ts";
import { verifyOptionalRequestSignature } from "../_shared/requestSignature.ts";
import { isValidEmail, sanitizeString } from "../_shared/validation.ts";

type SignupAction = "signup" | "complete_onboarding" | "request_demo" | "validate_request_contact";
type RequestedPackage = "starter" | "professional" | "enterprise";
type TenantInviteRow = {
  id: string;
  tenant_id: string;
  role: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

interface DemoSignupPayload {
  action?: SignupAction;
  full_name?: string;
  email?: string;
  password?: string;
  workspace_name?: string;
  invite_token?: string;
  business_name?: string;
  phone?: string;
  business_type?: string;
  message?: string;
  tenant_id?: string;
  requested_domain?: string;
  requested_package?: string;
}

interface ContactConflictResult {
  email?: string;
  phone?: string;
}

const MIN_PASSWORD_LENGTH = 8;
const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");

const toSafeName = (value: string, fallback: string): string => {
  const cleaned = sanitizeString(value, 80);
  return cleaned || fallback;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizePhone = (value: string): string => value.replace(/\D/g, "");

const hasContactConflicts = (conflicts: ContactConflictResult): boolean =>
  Boolean(conflicts.email || conflicts.phone);

const normalizeRequestedPackage = (value: string | undefined): RequestedPackage => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "professional") return "professional";
  if (normalized === "enterprise") return "enterprise";
  return "starter";
};

const buildInviteVerificationRedirectUrl = (inviteToken: string): string => {
  const url = new URL(`${APP_URL}/auth`);
  if (inviteToken) {
    url.searchParams.set("invite", inviteToken);
  }
  url.searchParams.set("verified", "1");
  return url.toString();
};

const isDuplicateAuthError = (message: string): boolean =>
  /already registered|already exists|already been registered|user already exists/i.test(message);

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) => {
  const normalizedEmail = normalizeEmail(email);

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

const readUserMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const buildPendingInviteUserMetadata = (
  baseMetadata: unknown,
  args: {
    fullName: string;
    workspaceName: string;
    inviteToken: string;
  },
) => ({
  ...readUserMetadata(baseMetadata),
  full_name: args.fullName,
  pending_invite_token: args.inviteToken,
  pending_workspace_name: args.workspaceName,
  pending_onboarding_flow: "tenant_invite",
});

const buildCompletedUserMetadata = (
  baseMetadata: unknown,
  args: {
    fullName: string;
    role: string;
    tenantId: string;
  },
) => ({
  ...readUserMetadata(baseMetadata),
  full_name: args.fullName,
  role: args.role,
  tenant_id: args.tenantId,
  pending_invite_token: null,
  pending_workspace_name: null,
  pending_onboarding_flow: null,
  onboarding_completed_at: new Date().toISOString(),
});

const clearPendingInviteUserMetadata = (baseMetadata: unknown) => ({
  ...readUserMetadata(baseMetadata),
  pending_invite_token: null,
  pending_workspace_name: null,
  pending_onboarding_flow: null,
});

const loadInviteByToken = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  inviteToken: string,
): Promise<TenantInviteRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("tenant_invites")
    .select("id, tenant_id, role, email, expires_at, accepted_at, accepted_by")
    .eq("token", inviteToken)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load invite: ${error.message}`);
  }

  return (data as TenantInviteRow | null) ?? null;
};

const getInviteWorkspaceName = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  fallbackWorkspaceName: string,
): Promise<string> => {
  const { data: tenantRow, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Failed to load workspace: ${tenantError.message}`);
  }

  const tenantName = sanitizeString(String(tenantRow?.name ?? ""), 80);
  return tenantName || fallbackWorkspaceName;
};


const findContactConflicts = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  args: {
    email?: string;
    phone?: string;
  },
): Promise<ContactConflictResult> => {
  const normalizedEmail = normalizeEmail(args.email ?? "");
  const normalizedPhone = normalizePhone(args.phone ?? "");
  const conflicts: ContactConflictResult = {};

  const emailChecks = normalizedEmail
    ? Promise.all([
      supabaseAdmin
        .from("demo_requests")
        .select("id, request_notification_status")
        .eq("status", "pending")
        .ilike("email", normalizedEmail)
        .limit(1),
      supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1),
    ])
    : Promise.resolve([null, null] as const);

  const phoneChecks = normalizedPhone
    ? Promise.all([
      supabaseAdmin
        .from("demo_requests")
        .select("phone, request_notification_status")
        .eq("status", "pending")
        .not("phone", "is", null),
      supabaseAdmin.from("profiles").select("phone").not("phone", "is", null),
    ])
    : Promise.resolve([null, null] as const);

  const [[demoEmailResult, profileEmailResult], [demoPhoneResult, profilePhoneResult]] =
    await Promise.all([emailChecks, phoneChecks]);

  if (demoEmailResult?.error) {
    throw new Error(`Failed to validate request email: ${demoEmailResult.error.message}`);
  }

  if (profileEmailResult?.error) {
    throw new Error(`Failed to validate profile email: ${profileEmailResult.error.message}`);
  }

  if (demoPhoneResult?.error) {
    throw new Error(`Failed to validate request phone: ${demoPhoneResult.error.message}`);
  }

  if (profilePhoneResult?.error) {
    throw new Error(`Failed to validate profile phone: ${profilePhoneResult.error.message}`);
  }

  const activeDemoEmailRows = (demoEmailResult?.data ?? []).filter(
    (row) => !["failed", "skipped"].includes(row.request_notification_status ?? ""),
  );
  const activeDemoPhoneRows = (demoPhoneResult?.data ?? []).filter(
    (row) => !["failed", "skipped"].includes(row.request_notification_status ?? ""),
  );

  const emailInUse = Boolean(
    normalizedEmail &&
    (activeDemoEmailRows.length > 0 || (profileEmailResult?.data?.length ?? 0) > 0),
  );

  const phoneInUse = Boolean(
    normalizedPhone &&
    [...activeDemoPhoneRows, ...(profilePhoneResult?.data ?? [])].some(
      (row) => normalizePhone(row.phone ?? "") === normalizedPhone,
    ),
  );

  if (emailInUse) {
    conflicts.email = "This email is used already, please provide another email";
  }

  if (phoneInUse) {
    conflicts.phone = "This phone number is used already, please provide another phone number";
  }

  return conflicts;
};

const mapInviteRoleToUserRole = (role: string): string => {
  if (role === "owner" || role === "admin") return "tenant_admin";
  if (role === "manager") return "manager";
  if (role === "staff") return "staff";
  return "viewer";
};

const ensureUserProfile = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  fullName: string,
  email: string,
  role: string,
): Promise<void> => {
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      email,
      role,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
    {
      user_id: userId,
      role: role as "superadmin" | "tenant_admin" | "manager" | "staff" | "viewer",
    },
    { onConflict: "user_id" },
  );

  if (roleError) {
    throw new Error(`Failed to assign admin role: ${roleError.message}`);
  }
};

const readPayload = async (req: Request): Promise<{ payload: DemoSignupPayload; rawBody: string }> => {
  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return { payload: {}, rawBody };
  }

  try {
    return { payload: JSON.parse(rawBody) as DemoSignupPayload, rawBody };
  } catch {
    throw new Error("Invalid JSON body");
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const rateLimit = checkRateLimit(
    getClientIdentifier(req),
    { ...RateLimitPresets.auth, keyPrefix: "demo-signup" },
  );
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit, corsHeaders);
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

    const { payload, rawBody } = await readPayload(req);
    const signatureCheck = await verifyOptionalRequestSignature(req, rawBody, {
      secretEnvKey: "PUBLIC_ENDPOINT_SIGNING_SECRET",
      maxSkewSeconds: 300,
    });
    if (!signatureCheck.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: signatureCheck.error ?? "Invalid request signature",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const action: SignupAction = payload.action ?? "signup";

    if (action === "validate_request_contact") {
      const conflicts = await findContactConflicts(supabaseAdmin, {
        email: payload.email,
        phone: payload.phone,
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: "validate_request_contact",
          valid: !hasContactConflicts(conflicts),
          field_errors: conflicts,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "request_demo") {
      const fullName = toSafeName(payload.full_name ?? "", "");
      const businessName = toSafeName(payload.business_name ?? "", "");
      const email = normalizeEmail(payload.email ?? "");
      const phone = toSafeName(payload.phone ?? "", "");
      const businessType = toSafeName(payload.business_type ?? "", "Other");
      const message = toSafeName(payload.message ?? "", "");
      const requestedDomain = toSafeName(payload.requested_domain ?? "", "");
      const requestedPackage = normalizeRequestedPackage(payload.requested_package);
      const tenantId = payload.tenant_id ?? null;

      if (!fullName || !businessName || !email || !phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!isValidEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid email address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const conflicts = await findContactConflicts(supabaseAdmin, { email, phone });
      if (hasContactConflicts(conflicts)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Email or phone number is already in use",
            field_errors: conflicts,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: insertedDemoRequest, error: demoRequestError } = await supabaseAdmin
        .from("demo_requests")
        .insert({
          tenant_id: tenantId,
          full_name: fullName,
          business_name: businessName,
          email,
          phone,
          requested_domain: requestedDomain || null,
          requested_package: requestedPackage,
          business_type: businessType,
          message: message || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (demoRequestError) {
        throw new Error(`Failed to save demo request: ${demoRequestError.message}`);
      }

      let notificationResult: NotificationDeliveryResult = {
        status: "pending",
        error: null,
      };

      if (insertedDemoRequest?.id) {
        notificationResult = await sendTenantApplicationNotification({
          requestId: insertedDemoRequest.id,
          fullName,
          businessName,
          email,
          phone,
          requestedDomain: requestedDomain || "Not provided",
          businessType,
          message,
          sendApplicantVerification: false,
        });
        await persistTenantApplicationNotificationResult(
          supabaseAdmin,
          insertedDemoRequest.id,
          notificationResult,
        );

        if (notificationResult.status !== "sent") {
          console.warn(
            `Tenant request ${insertedDemoRequest.id} saved without verification email delivery: ${notificationResult.error ?? notificationResult.status}`,
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "request_demo",
          request_notification_status: notificationResult.status,
          request_notification_error: notificationResult.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "signup") {
      const fullName = toSafeName(payload.full_name ?? "", "Demo User");
      const workspaceName = toSafeName(
        payload.workspace_name ?? "",
        `${fullName}'s Workspace`,
      );
      const email = (payload.email ?? "").trim().toLowerCase();
      const password = payload.password ?? "";
      const inviteToken = String(payload.invite_token ?? "").trim();

      if (!inviteToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Direct signup is disabled. Wait for superadmin approval or use a valid invite link.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!isValidEmail(email)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email address" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let inviteRow:
        | TenantInviteRow
        | null = null;

      if (inviteToken) {
        const inviteData = await loadInviteByToken(supabaseAdmin, inviteToken);
        if (!inviteData) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid or expired invite" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (inviteData.accepted_at) {
          return new Response(
            JSON.stringify({ success: false, error: "Invite already used" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ success: false, error: "Invite expired" }),
            { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (inviteData.email && inviteData.email.toLowerCase() !== email.toLowerCase()) {
          return new Response(
            JSON.stringify({ success: false, error: "Invite email does not match" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        inviteRow = inviteData;
      }

      if (!inviteRow) {
        throw new Error("Direct tenant provisioning is disabled");
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      if (!anonKey) {
        throw new Error("SUPABASE_ANON_KEY is not configured");
      }

      const supabaseAnon = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const verificationRedirectTo = buildInviteVerificationRedirectUrl(inviteToken);
      const pendingUserMetadata = buildPendingInviteUserMetadata(null, {
        fullName,
        workspaceName,
        inviteToken,
      });

      const { data: signupData, error: signupError } = await supabaseAnon.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: verificationRedirectTo,
          data: pendingUserMetadata,
        },
      });
      const returnedExistingUser = Boolean(
        signupData?.user &&
        Array.isArray(signupData.user.identities) &&
        signupData.user.identities.length === 0,
      );

      if (signupError || !signupData.user || returnedExistingUser) {
        const signupMessage = signupError?.message ?? (returnedExistingUser ? "User already registered" : "Failed to create account");
        if (!returnedExistingUser && !isDuplicateAuthError(signupMessage)) {
          return new Response(
            JSON.stringify({ success: false, error: signupMessage }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
        if (!existingUser) {
          return new Response(
            JSON.stringify({ success: false, error: "Email already in use" }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (existingUser.email_confirmed_at) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "This email is already registered. Sign in to continue.",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const { error: existingUserUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            password,
            user_metadata: buildPendingInviteUserMetadata(existingUser.user_metadata, {
              fullName,
              workspaceName,
              inviteToken,
            }),
          },
        );

        if (existingUserUpdateError) {
          throw new Error(`Failed to refresh pending invite account: ${existingUserUpdateError.message}`);
        }

        const { error: resendError } = await supabaseAnon.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: verificationRedirectTo,
          },
        });

        if (resendError) {
          throw new Error(`Failed to resend verification email: ${resendError.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: "signup",
            user_id: existingUser.id,
            tenant_id: inviteRow.tenant_id,
            created_new_tenant: false,
            requires_email_verification: true,
            email_resent: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "signup",
          user_id: signupData.user.id,
          tenant_id: inviteRow.tenant_id,
          created_new_tenant: false,
          requires_email_verification: !signupData.user.email_confirmed_at,
          email_resent: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "complete_onboarding") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const accessToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

      if (!accessToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing access token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const {
        data: { user: authUser },
        error: authUserError,
      } = await supabaseAdmin.auth.getUser(accessToken);

      if (authUserError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!authUser.email_confirmed_at) {
        return new Response(
          JSON.stringify({ success: false, error: "Verify your email before completing onboarding." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authUserMetadata = readUserMetadata(authUser.user_metadata);
      const inviteToken = String(
        payload.invite_token ??
        authUserMetadata.pending_invite_token ??
        "",
      ).trim();

      if (!inviteToken) {
        return new Response(
          JSON.stringify({ success: false, error: "No pending tenant invite was found for this account." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const inviteRow = await loadInviteByToken(supabaseAdmin, inviteToken);
      if (!inviteRow) {
        const { error: clearMetadataError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          user_metadata: clearPendingInviteUserMetadata(authUser.user_metadata),
        });
        if (clearMetadataError) {
          console.warn(`Failed to clear invalid invite metadata for ${authUser.id}: ${clearMetadataError.message}`);
        }

        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired invite" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (inviteRow.accepted_at && inviteRow.accepted_by && inviteRow.accepted_by !== authUser.id) {
        const { error: clearMetadataError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          user_metadata: clearPendingInviteUserMetadata(authUser.user_metadata),
        });
        if (clearMetadataError) {
          console.warn(`Failed to clear used invite metadata for ${authUser.id}: ${clearMetadataError.message}`);
        }

        return new Response(
          JSON.stringify({ success: false, error: "Invite already used" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
        const { error: clearMetadataError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          user_metadata: clearPendingInviteUserMetadata(authUser.user_metadata),
        });
        if (clearMetadataError) {
          console.warn(`Failed to clear expired invite metadata for ${authUser.id}: ${clearMetadataError.message}`);
        }

        return new Response(
          JSON.stringify({ success: false, error: "Invite expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const email = normalizeEmail(authUser.email ?? payload.email ?? "");
      if (!email) {
        throw new Error("Authenticated user email is missing");
      }

      if (inviteRow.email && normalizeEmail(inviteRow.email) !== email) {
        return new Response(
          JSON.stringify({ success: false, error: "Invite email does not match" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fullName = toSafeName(
        String(authUserMetadata.full_name ?? payload.full_name ?? ""),
        email.split("@")[0] || "Team Member",
      );
      const workspaceName = await getInviteWorkspaceName(
        supabaseAdmin,
        inviteRow.tenant_id,
        toSafeName(String(authUserMetadata.pending_workspace_name ?? ""), "Workspace"),
      );
      const tenantRole = inviteRow.role || "member";
      const userRole = mapInviteRoleToUserRole(tenantRole);

      await ensureUserProfile(
        supabaseAdmin,
        authUser.id,
        fullName,
        email,
        userRole,
      );

      const { error: memberError } = await supabaseAdmin.from("tenant_members").upsert(
        {
          tenant_id: inviteRow.tenant_id,
          user_id: authUser.id,
          role: tenantRole,
          is_default: true,
          is_active: true,
          invited_by: null,
        },
        { onConflict: "tenant_id,user_id" },
      );

      if (memberError) {
        throw new Error(`Failed to assign tenant membership: ${memberError.message}`);
      }

      if (!inviteRow.accepted_at || inviteRow.accepted_by !== authUser.id) {
        const { error: inviteUpdateError } = await supabaseAdmin
          .from("tenant_invites")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by: authUser.id,
          })
          .eq("id", inviteRow.id);

        if (inviteUpdateError) {
          throw new Error(`Failed to mark invite as accepted: ${inviteUpdateError.message}`);
        }
      }

      await ensureTenantOperationalState(
        supabaseAdmin,
        {
          tenantId: inviteRow.tenant_id,
          workspaceName,
          userId: authUser.id,
          fullName,
          email,
        },
      );

      const { error: metadataUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: buildCompletedUserMetadata(authUser.user_metadata, {
          fullName,
          role: userRole,
          tenantId: inviteRow.tenant_id,
        }),
      });
      if (metadataUpdateError) {
        console.warn(`Failed to finalize onboarding metadata for ${authUser.id}: ${metadataUpdateError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "complete_onboarding",
          user_id: authUser.id,
          tenant_id: inviteRow.tenant_id,
          role: userRole,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unsupported action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("demo-signup error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
