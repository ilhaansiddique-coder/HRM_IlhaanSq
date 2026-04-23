import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";

type AdminClient = ReturnType<typeof createClient>;

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

const ensureBillingRow = async (supabaseAdmin: AdminClient, tenantId: string) => {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("tenant_billing")
    .select("id, stripe_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to check billing settings: ${readError.message}`);
  }

  if (existing) {
    return existing;
  }

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
    throw new Error(`Failed to create billing settings: ${createError?.message ?? "Unknown error"}`);
  }

  return created;
};

const ensureTenantUsage = async (supabaseAdmin: AdminClient, tenantId: string) => {
  const { data: existing, error } = await supabaseAdmin
    .from("tenant_usage")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check tenant usage: ${error.message}`);
  }

  if (existing) {
    return;
  }

  const { error: insertError } = await supabaseAdmin.from("tenant_usage").insert({
    tenant_id: tenantId,
  });

  if (insertError) {
    throw new Error(`Failed to create tenant usage: ${insertError.message}`);
  }
};

const ensureBusinessSettings = async (
  supabaseAdmin: AdminClient,
  tenantId: string,
  workspaceName: string,
  userId: string,
  email: string,
) => {
  const { data: existing, error } = await supabaseAdmin
    .from("business_settings")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check business settings: ${error.message}`);
  }

  if (existing) {
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from("business_settings")
    .insert({
      tenant_id: tenantId,
      business_name: workspaceName,
      created_by: userId,
      email,
      invoice_prefix: "INV",
      invoice_footer_message: "Thank you for your business.",
    });

  if (insertError) {
    throw new Error(`Failed to create business settings: ${insertError.message}`);
  }
};

const ensureCourierSettings = async (supabaseAdmin: AdminClient, tenantId: string) => {
  const { data: existing, error } = await supabaseAdmin
    .from("courier_webhook_settings")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check courier settings: ${error.message}`);
  }

  if (existing) {
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from("courier_webhook_settings")
    .insert({
      tenant_id: tenantId,
      webhook_url: "",
      webhook_name: "",
      webhook_description: "Default courier settings",
      status_check_webhook_url: "",
      is_active: false,
      steadfast_enabled: false,
      pathao_enabled: false,
      auto_refresh_interval_minutes: 60,
    });

  if (insertError) {
    throw new Error(`Failed to create courier settings: ${insertError.message}`);
  }
};

const ensureNotificationTemplates = async (supabaseAdmin: AdminClient, tenantId: string) => {
  const templates = [
    {
      key: "welcome_email",
      channel: "email",
      subject: "Welcome to {{workspace_name}}",
      body_html:
        "<h1>Welcome to {{workspace_name}}</h1><p>Hello {{owner_name}}, your workspace is ready.</p><p>Sign in at <a href=\"{{login_url}}\">{{login_url}}</a>.</p>",
      body_text:
        "Welcome to {{workspace_name}}. Hello {{owner_name}}, your workspace is ready. Sign in at {{login_url}}.",
    },
    {
      key: "tenant_invite",
      channel: "email",
      subject: "You have been invited to {{workspace_name}}",
      body_html:
        "<p>Hello {{owner_name}}, you have been invited to {{workspace_name}}.</p><p>Open {{login_url}} to continue.</p>",
      body_text:
        "You have been invited to {{workspace_name}}. Open {{login_url}} to continue.",
    },
    {
      key: "billing_status",
      channel: "email",
      subject: "Billing update for {{workspace_name}}",
      body_html: "<p>Your billing status changed for {{workspace_name}}.</p>",
      body_text: "Your billing status changed for {{workspace_name}}.",
    },
  ];

  const rows = templates.map((template) => ({
    tenant_id: tenantId,
    ...template,
  }));

  const { error } = await supabaseAdmin
    .from("notification_templates")
    .upsert(rows, { onConflict: "tenant_id,key,channel", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to seed notification templates: ${error.message}`);
  }
};

const ensureTenantRolePermissions = async (supabaseAdmin: AdminClient, tenantId: string) => {
  const { data: seedPermissions, error: readError } = await supabaseAdmin
    .from("role_permissions")
    .select("role, permission_key, allowed");

  if (readError) {
    throw new Error(`Failed to read system role permissions: ${readError.message}`);
  }

  if (!seedPermissions?.length) {
    return;
  }

  const rows = seedPermissions.map((permission) => ({
    tenant_id: tenantId,
    role: permission.role,
    permission_key: permission.permission_key,
    allowed: permission.allowed,
    source: "system_seed",
  }));

  const { error } = await supabaseAdmin
    .from("tenant_role_permissions")
    .upsert(rows, { onConflict: "tenant_id,role,permission_key", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to seed tenant role permissions: ${error.message}`);
  }
};

const ensureStripeCustomer = async (
  supabaseAdmin: AdminClient,
  args: {
    tenantId: string;
    userId: string;
    email: string;
    fullName: string;
  },
) => {
  if (!stripe) {
    return null;
  }

  const billing = await ensureBillingRow(supabaseAdmin, args.tenantId);
  if (billing.stripe_customer_id) {
    return billing.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: args.email,
    name: args.fullName || undefined,
    metadata: {
      tenant_id: args.tenantId,
      user_id: args.userId,
    },
  });

  const { error } = await supabaseAdmin
    .from("tenant_billing")
    .update({ stripe_customer_id: customer.id })
    .eq("id", billing.id);

  if (error) {
    throw new Error(`Failed to store Stripe customer: ${error.message}`);
  }

  return customer.id;
};

export const ensureTenantOperationalState = async (
  supabaseAdmin: AdminClient,
  args: {
    tenantId: string;
    workspaceName: string;
    userId: string;
    fullName: string;
    email: string;
  },
) => {
  await ensureBillingRow(supabaseAdmin, args.tenantId);
  await ensureTenantUsage(supabaseAdmin, args.tenantId);
  await ensureNotificationTemplates(supabaseAdmin, args.tenantId);
  await ensureTenantRolePermissions(supabaseAdmin, args.tenantId);
  await ensureBusinessSettings(
    supabaseAdmin,
    args.tenantId,
    args.workspaceName,
    args.userId,
    args.email,
  );
  await ensureCourierSettings(supabaseAdmin, args.tenantId);

  try {
    await ensureStripeCustomer(supabaseAdmin, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Stripe error";
    console.error(`Stripe customer bootstrap failed for tenant ${args.tenantId}: ${message}`);
  }
};

export const sendTenantWelcomeEmail = async (
  _supabaseAdmin: AdminClient,
  args: {
    tenantId: string;
    workspaceName: string;
    fullName: string;
    email: string;
    tempPassword?: string;
    requiresPasswordReset?: boolean;
    source?: string;
  },
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    console.warn("Skipped tenant welcome email: SUPABASE_ANON_KEY is not configured.");
    return;
  }

  const baseAppUrl = APP_URL.replace(/\/+$/, "");
  const appName = (Deno.env.get("APP_NAME") ?? "RaheDeen Inventory").trim() || "RaheDeen Inventory";
  const supportEmail = (Deno.env.get("SUPPORT_EMAIL") ?? "").trim();
  const redirectTo = `${baseAppUrl}/auth?source=tenant-welcome`;
  const loginUrl = `${baseAppUrl}/auth`;
  const resetPasswordUrl = `${baseAppUrl}/reset-password?forced=true`;
  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabaseAnon.auth.signInWithOtp({
    email: args.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
      data: {
        source: args.source ?? "tenant_welcome",
        tenant_id: args.tenantId,
        workspace_name: args.workspaceName,
        owner_name: args.fullName || "there",
        app_name: appName,
        support_email: supportEmail,
        login_url: loginUrl,
        reset_password_url: resetPasswordUrl,
        temp_password: args.tempPassword ?? "",
        temporary_password_message: args.requiresPasswordReset
          ? "This is your temporary password, please reset & set new password of your own."
          : "",
        force_password_reset: Boolean(args.requiresPasswordReset),
      },
    },
  });

  if (error) {
    throw new Error(`Supabase welcome email failed: ${error.message}`);
  }
};
