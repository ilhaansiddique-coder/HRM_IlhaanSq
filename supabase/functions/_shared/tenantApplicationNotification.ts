import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationDeliveryResult {
  status: NotificationDeliveryStatus;
  error: string | null;
}

export interface TenantApplicationNotificationArgs {
  requestId: string;
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  requestedDomain: string;
  businessType: string;
  message: string;
  sendApplicantVerification?: boolean;
}

export interface SuperAdminTenantCreatedNotificationArgs {
  tenantId: string;
  tenantName: string;
  tenantAdminName: string;
  tenantAdminEmail: string;
  planKey: string;
  createdByName: string;
  createdByEmail: string;
}

type AdminClient = ReturnType<typeof createClient>;

const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_APP_NAME = "RaheDeen Inventory";

const parseEmailList = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  );

const normalizeNotificationResult = (
  result: NotificationDeliveryResult,
): NotificationDeliveryResult => {
  return result;
};

export const sendTenantApplicationNotification = async (
  args: TenantApplicationNotificationArgs,
): Promise<NotificationDeliveryResult> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return {
      status: "skipped",
      error: "SUPABASE_ANON_KEY is not configured for tenant request email verification.",
    };
  }

  const appUrl = (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");
  const appName = (Deno.env.get("APP_NAME") ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
  const supportEmail = (Deno.env.get("SUPPORT_EMAIL") ?? "").trim();
  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const shouldSendApplicantVerification = args.sendApplicantVerification !== false;

  if (shouldSendApplicantVerification) {
    const emailRedirectTo = `${appUrl}/auth?source=tenant-request-verification`;
    const { error } = await supabaseAnon.auth.signInWithOtp({
      email: args.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
        data: {
          source: "tenant_request",
          tenant_request_id: args.requestId,
          applicant_name: args.fullName,
          business_name: args.businessName,
          requested_domain: args.requestedDomain,
          business_type: args.businessType,
          contact_phone: args.phone,
          app_name: appName,
          support_email: supportEmail,
          submitted_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      return normalizeNotificationResult({
        status: "failed",
        error: `Supabase email verification send failed: ${error.message}`,
      });
    }
  }

  // Optional: notify superadmin inbox emails (no custom provider).
  // These addresses should already exist in Supabase Auth.
  const notifyEmailsRaw =
    Deno.env.get("TENANT_REQUEST_NOTIFY_EMAILS") ??
    Deno.env.get("TENANT_REQUEST_NOTIFY_EMAIL") ??
    "";
  const notifyEmails = parseEmailList(notifyEmailsRaw);
  if (notifyEmails.length > 0) {
    const adminRedirectTo = `${appUrl}/super-admin?tab=tenant-requests&source=tenant-request-alert`;

    for (const notifyEmail of notifyEmails) {
      const { error: notifyError } = await supabaseAnon.auth.signInWithOtp({
        email: notifyEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: adminRedirectTo,
          data: {
            source: "tenant_request_alert",
            tenant_request_id: args.requestId,
            applicant_email: args.email,
            applicant_name: args.fullName,
            business_name: args.businessName,
            requested_domain: args.requestedDomain,
            business_type: args.businessType,
            contact_phone: args.phone,
            app_name: appName,
            support_email: supportEmail,
            admin_panel_url: adminRedirectTo,
            submitted_at: new Date().toISOString(),
          },
        },
      });

      if (notifyError) {
        console.warn(
          `Superadmin tenant request alert failed for ${notifyEmail}: ${notifyError.message}`,
        );
      }
    }
  }

  return normalizeNotificationResult({
    status: notifyEmails.length > 0 || shouldSendApplicantVerification ? "sent" : "skipped",
    error: null,
  });
};

export const sendSuperAdminTenantCreatedNotification = async (
  args: SuperAdminTenantCreatedNotificationArgs,
): Promise<NotificationDeliveryResult> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return {
      status: "skipped",
      error: "SUPABASE_ANON_KEY is not configured for tenant creation notifications.",
    };
  }

  const notifyEmailsRaw =
    Deno.env.get("TENANT_REQUEST_NOTIFY_EMAILS") ??
    Deno.env.get("TENANT_REQUEST_NOTIFY_EMAIL") ??
    "";
  const notifyEmails = parseEmailList(notifyEmailsRaw);
  if (notifyEmails.length === 0) {
    return {
      status: "skipped",
      error: "No superadmin notification inbox addresses are configured.",
    };
  }

  const appUrl = (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");
  const appName = (Deno.env.get("APP_NAME") ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
  const supportEmail = (Deno.env.get("SUPPORT_EMAIL") ?? "").trim();
  const adminRedirectTo = `${appUrl}/super-admin?tab=tenants&source=tenant-created-alert`;
  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let hasFailure = false;
  const failureMessages: string[] = [];

  for (const notifyEmail of notifyEmails) {
    const { error } = await supabaseAnon.auth.signInWithOtp({
      email: notifyEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: adminRedirectTo,
        data: {
          source: "tenant_created_alert",
          tenant_id: args.tenantId,
          tenant_name: args.tenantName,
          tenant_admin_name: args.tenantAdminName,
          tenant_admin_email: args.tenantAdminEmail,
          plan_key: args.planKey,
          created_by_name: args.createdByName,
          created_by_email: args.createdByEmail,
          app_name: appName,
          support_email: supportEmail,
          admin_panel_url: adminRedirectTo,
          submitted_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      hasFailure = true;
      failureMessages.push(`${notifyEmail}: ${error.message}`);
    }
  }

  return hasFailure
    ? normalizeNotificationResult({
        status: "failed",
        error: failureMessages.join("; "),
      })
    : normalizeNotificationResult({
        status: "sent",
        error: null,
      });
};

export const persistTenantApplicationNotificationResult = async (
  supabaseAdmin: AdminClient,
  requestId: string,
  result: NotificationDeliveryResult,
): Promise<void> => {
  const normalizedResult = normalizeNotificationResult(result);

  const updates = {
    request_notification_status: normalizedResult.status,
    request_notification_sent_at: normalizedResult.status === "sent" ? new Date().toISOString() : null,
    request_notification_error: normalizedResult.error,
  };

  const { error } = await supabaseAdmin
    .from("demo_requests")
    .update(updates)
    .eq("id", requestId);

  if (error) {
    console.error(
      `Failed to persist tenant request notification status for ${requestId}: ${error.message}`,
    );
  }
};
