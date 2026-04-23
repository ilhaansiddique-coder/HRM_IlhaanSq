import { invokeProtectedApi } from "@/utils/invokeProtectedApi";
import { invokeProtectedFunction } from "@/utils/invokeProtectedFunction";
import { supabase } from "@/integrations/supabase/client";
import type { BillingPlanKey } from "@/constants/packagePlans";
import { formatInTimeZone } from "@/lib/time";

export type TenantStatus = "active" | "inactive";
export type TenantEmployeeStatus = "active" | "inactive";

export interface TenantRecord {
  id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_slug?: string;
  tenant_admin_name?: string | null;
  tenant_admin_email?: string | null;
  tenant_admin_phone?: string | null;
  welcome_email_status?: string | null;
  welcome_email_sent_at?: string | null;
  welcome_email_error?: string | null;
  welcome_email_error_code?: string | null;
  password: string;
  tenant_status: TenantStatus;
  users_count: number;
  customers_count: number;
  created_at: string;
  deleted_at: string | null;
}

export interface TenantDetailRecord extends TenantRecord {
  tenant_slug: string;
  company_name: string;
  products_count: number;
  daily_order_quantity: number;
  daily_transaction_amount: number;
  week_order_quantity: number;
  week_transaction_amount: number;
  total_order_quantity: number;
  total_transaction_amount: number;
  updated_at: string;
  recent_activity: Array<{ date: string; order_count: number; transaction_amount: number }>;
}

export interface TenantInput {
  tenant_name: string;
  tenant_email: string;
  password: string;
  tenant_status: TenantStatus;
}

export interface DeleteTenantOptions {
  mode: "soft" | "hard";
}

export interface TenantRoleRecord {
  id: string;
  role_name: string;
  tenant_id: string;
  permissions: string[];
  created_at: string;
}

export interface TenantRoleInput {
  role_name: string;
  tenant_id: string;
  permissions: string[];
}

export interface TenantEmployeeRecord {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  status: TenantEmployeeStatus;
  joined_at: string;
}

export interface CreateTenantAdminInput {
  tenant_name: string;
  admin_email: string;
  admin_phone: string;
  password: string;
  plan_key: BillingPlanKey;
}

export interface CreateTenantAdminResult {
  success: boolean;
  tenant_id: string;
  user_id: string;
  email: string;
  email_sent: boolean;
  email_error?: string | null;
  email_error_code?: string | null;
  login_url: string;
  requires_password_reset?: boolean;
}

export interface TenantContactValidationResult {
  success: boolean;
  valid: boolean;
  field_errors?: {
    admin_email?: string;
    admin_phone?: string;
  };
}

export interface TenantBillingPlanRecord {
  tenant_id: string;
  plan_key: BillingPlanKey;
  status: string;
}

export const tenantManagementQueryKeys = {
  all: ["tenant-management"] as const,
  tenants: ["tenant-management", "tenants"] as const,
  roles: ["tenant-management", "roles"] as const,
  billing: (tenantId: string) => ["tenant-management", "tenant-billing", tenantId] as const,
  employees: (tenantId: string) => ["tenant-management", "employees", tenantId] as const,
};

export const TENANT_PERMISSION_OPTIONS = [
  "billing.view",
  "billing.edit",
  "employees.view",
  "employees.manage",
  "inventory.view",
  "inventory.edit",
  "reports.view",
  "reports.export",
  "settings.view",
  "settings.edit",
] as const;

type PlatformTenantRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  company_name?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_phone?: string | null;
  welcome_email_status?: string | null;
  welcome_email_sent_at?: string | null;
  welcome_email_error?: string | null;
  welcome_email_error_code?: string | null;
  users_count?: number | null;
  customers_count?: number | null;
  daily_order_quantity?: number | null;
  daily_transaction_amount?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PlatformTenantDetail = PlatformTenantRow & {
  customers_count: number;
  products_count: number;
  daily_order_quantity: number;
  daily_transaction_amount: number;
  week_order_quantity: number;
  week_transaction_amount: number;
  total_order_quantity: number;
  total_transaction_amount: number;
  recent_activity: Array<{ date: string; order_count: number; transaction_amount: number }>;
};

type LooseRow = Record<string, unknown>;

const DHAKA_TIME_ZONE = "Asia/Dhaka";
const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  "";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const isPrivateIpv4Address = (hostname: string) =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isLocalOrPrivateHostname = (hostname: string) =>
  LOCAL_HOSTNAMES.has(hostname.toLowerCase()) || isPrivateIpv4Address(hostname);

const shouldPreferDirectTenantData = (rawApiUrl: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isLocalOrPrivateHostname(window.location.hostname)) {
    return true;
  }

  if (!rawApiUrl) {
    return true;
  }

  try {
    const parsedUrl = new URL(rawApiUrl, window.location.origin);
    return isLocalOrPrivateHostname(parsedUrl.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\./i.test(rawApiUrl);
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
};

const isTenantApiUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /cannot connect to api|failed to fetch|networkerror|err_connection_refused|econnrefused|service unavailable|statuscode":503|platform db is unavailable|getaddrinfo enotfound|enotfound/i.test(
    message,
  );
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

let tenantSequence = 1000;
let roleSequence = 3000;
let employeeSequence = 6000;

let tenants: TenantRecord[] = [];
let roles: TenantRoleRecord[] = [];
let employees: TenantEmployeeRecord[] = [];

const mapPlatformTenant = (row: PlatformTenantRow): TenantRecord => ({
  id: row.tenant_id,
  tenant_name: row.tenant_name || row.company_name || row.tenant_slug || row.tenant_id,
  tenant_email: row.admin_email || "",
  tenant_slug: row.tenant_slug,
  tenant_admin_name: row.admin_name ?? null,
  tenant_admin_email: row.admin_email ?? null,
  tenant_admin_phone: row.admin_phone ?? null,
  welcome_email_status: row.welcome_email_status ?? null,
  welcome_email_sent_at: row.welcome_email_sent_at ?? null,
  welcome_email_error: row.welcome_email_error ?? null,
  welcome_email_error_code: row.welcome_email_error_code ?? null,
  password: "",
  tenant_status: row.is_active ? "active" : "inactive",
  users_count: Number(row.users_count ?? 0),
  customers_count: Number(row.customers_count ?? 0),
  created_at: row.created_at || row.updated_at,
  deleted_at: row.is_active ? null : row.updated_at ?? null,
});

const mapPlatformTenantDetail = (row: PlatformTenantDetail): TenantDetailRecord => ({
  ...mapPlatformTenant(row),
  tenant_slug: row.tenant_slug,
  company_name: row.company_name || row.tenant_name,
  customers_count: Number(row.customers_count ?? 0),
  products_count: Number(row.products_count ?? 0),
  daily_order_quantity: Number(row.daily_order_quantity ?? 0),
  daily_transaction_amount: Number(row.daily_transaction_amount ?? 0),
  week_order_quantity: Number(row.week_order_quantity ?? 0),
  week_transaction_amount: Number(row.week_transaction_amount ?? 0),
  total_order_quantity: Number(row.total_order_quantity ?? 0),
  total_transaction_amount: Number(row.total_transaction_amount ?? 0),
  updated_at: row.updated_at,
  recent_activity: row.recent_activity ?? [],
});

const buildPlatformTenantRowsDirect = async (): Promise<PlatformTenantRow[]> => {
  const todayKey = formatInTimeZone(new Date(), "yyyy-MM-dd", DHAKA_TIME_ZONE);
  const salesWindowStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    tenantsResult,
    businessSettingsResult,
    tenantMembersResult,
    profilesResult,
    customersResult,
    salesResult,
  ] = await Promise.all([
    (supabase as any).from("tenants").select("id, slug, name, is_active, created_at, updated_at"),
    (supabase as any).from("business_settings").select("tenant_id, business_name, updated_at"),
    (supabase as any)
      .from("tenant_members")
      .select("tenant_id, user_id, role, is_active, is_default, created_at"),
    (supabase as any).from("profiles").select("id, full_name, email, phone"),
    (supabase as any).from("customers").select("tenant_id, is_deleted"),
    (supabase as any)
      .from("sales")
      .select("tenant_id, created_at, grand_total, fee")
      .gte("created_at", salesWindowStart),
  ]);

  if (tenantsResult.error) throw new Error(tenantsResult.error.message || "Failed to load tenants");
  if (businessSettingsResult.error) throw new Error(businessSettingsResult.error.message || "Failed to load business settings");
  if (tenantMembersResult.error) throw new Error(tenantMembersResult.error.message || "Failed to load tenant members");
  if (profilesResult.error) throw new Error(profilesResult.error.message || "Failed to load profiles");
  if (customersResult.error) throw new Error(customersResult.error.message || "Failed to load customers");
  if (salesResult.error) throw new Error(salesResult.error.message || "Failed to load sales");

  const latestBusinessNameByTenant = new Map<string, { businessName: string; updatedAt: string }>();
  ((businessSettingsResult.data ?? []) as LooseRow[]).forEach((row) => {
    const tenantId = String(row.tenant_id ?? "");
    const businessName = String(row.business_name ?? "").trim();
    const updatedAt = String(row.updated_at ?? "");
    if (!tenantId || !businessName) {
      return;
    }

    const current = latestBusinessNameByTenant.get(tenantId);
    if (!current || updatedAt > current.updatedAt) {
      latestBusinessNameByTenant.set(tenantId, { businessName, updatedAt });
    }
  });

  const profilesById = new Map<string, LooseRow>();
  ((profilesResult.data ?? []) as LooseRow[]).forEach((row) => {
    profilesById.set(String(row.id ?? ""), row);
  });

  const adminByTenant = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
  const membersByTenant = new Map<string, LooseRow[]>();
  ((tenantMembersResult.data ?? []) as LooseRow[]).forEach((row) => {
    if (row.is_active === false) {
      return;
    }

    const tenantId = String(row.tenant_id ?? "");
    if (!tenantId) {
      return;
    }

    const current = membersByTenant.get(tenantId) ?? [];
    current.push(row);
    membersByTenant.set(tenantId, current);
  });

  const userCountByTenant = new Map<string, number>();
  membersByTenant.forEach((rows, tenantId) => {
    userCountByTenant.set(tenantId, rows.length);
  });

  membersByTenant.forEach((rows, tenantId) => {
    const sortedRows = [...rows].sort((left, right) => {
      const leftRole = String(left.role ?? "").trim().toLowerCase();
      const rightRole = String(right.role ?? "").trim().toLowerCase();
      const priority = (role: string) => {
        if (role === "tenant_admin" || role === "tenant admin" || role === "owner") return 0;
        if (role === "admin") return 1;
        return 2;
      };

      const roleDelta = priority(leftRole) - priority(rightRole);
      if (roleDelta !== 0) return roleDelta;

      if (Boolean(left.is_default) !== Boolean(right.is_default)) {
        return right.is_default ? 1 : -1;
      }

      return new Date(String(right.created_at ?? 0)).getTime() - new Date(String(left.created_at ?? 0)).getTime();
    });

    const selected = sortedRows[0];
    const profile = profilesById.get(String(selected?.user_id ?? ""));
    adminByTenant.set(tenantId, {
      name: profile?.full_name ? String(profile.full_name) : null,
      email: profile?.email ? String(profile.email) : null,
      phone: profile?.phone ? String(profile.phone) : null,
    });
  });

  const customerCountByTenant = new Map<string, number>();
  ((customersResult.data ?? []) as LooseRow[]).forEach((row) => {
    if (row.is_deleted) {
      return;
    }

    const tenantId = String(row.tenant_id ?? "");
    if (!tenantId) {
      return;
    }

    customerCountByTenant.set(tenantId, (customerCountByTenant.get(tenantId) ?? 0) + 1);
  });

  const dailySalesByTenant = new Map<string, { orders: number; revenue: number }>();
  ((salesResult.data ?? []) as LooseRow[]).forEach((row) => {
    const tenantId = String(row.tenant_id ?? "");
    const createdAt = String(row.created_at ?? "");
    if (!tenantId || !createdAt) {
      return;
    }

    if (formatInTimeZone(new Date(createdAt), "yyyy-MM-dd", DHAKA_TIME_ZONE) !== todayKey) {
      return;
    }

    const entry = dailySalesByTenant.get(tenantId) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += Math.max(0, (Number(row.grand_total ?? 0) || 0) - (Number(row.fee ?? 0) || 0));
    dailySalesByTenant.set(tenantId, entry);
  });

  return ((tenantsResult.data ?? []) as LooseRow[]).map((row) => {
    const tenantId = String(row.id ?? "");
    const admin = adminByTenant.get(tenantId);
    const daily = dailySalesByTenant.get(tenantId) ?? { orders: 0, revenue: 0 };
    return {
      tenant_id: tenantId,
      tenant_slug: String(row.slug ?? ""),
      tenant_name: String(row.name ?? ""),
      company_name: latestBusinessNameByTenant.get(tenantId)?.businessName ?? String(row.name ?? ""),
      admin_name: admin?.name ?? null,
      admin_email: admin?.email ?? null,
      admin_phone: admin?.phone ?? null,
      welcome_email_status: null,
      welcome_email_sent_at: null,
      welcome_email_error: null,
      welcome_email_error_code: null,
      users_count: userCountByTenant.get(tenantId) ?? 0,
      customers_count: customerCountByTenant.get(tenantId) ?? 0,
      daily_transaction_amount: daily.revenue,
      daily_order_quantity: daily.orders,
      is_active: Boolean(row.is_active),
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
    };
  });
};

const buildPlatformTenantDetailDirect = async (tenantId: string): Promise<PlatformTenantDetail> => {
  const [platformRows, productsResult, salesResult] = await Promise.all([
    buildPlatformTenantRowsDirect(),
    (supabase as any).from("products").select("tenant_id, is_deleted").eq("tenant_id", tenantId),
    (supabase as any)
      .from("sales")
      .select("tenant_id, created_at, grand_total, fee, is_deleted, payment_status")
      .eq("tenant_id", tenantId),
  ]);

  const baseRow = platformRows.find((row) => row.tenant_id === tenantId);
  if (!baseRow) {
    throw new Error("Tenant not found.");
  }

  if (productsResult.error) throw new Error(productsResult.error.message || "Failed to load products");
  if (salesResult.error) throw new Error(salesResult.error.message || "Failed to load sales");

  const productsCount = ((productsResult.data ?? []) as LooseRow[]).filter((row) => !row.is_deleted).length;
  const visibleSales = ((salesResult.data ?? []) as LooseRow[]).filter(
    (row) => !row.is_deleted && String(row.payment_status ?? "").toLowerCase() !== "cancelled",
  );

  const recentActivityMap = new Map<string, { order_count: number; transaction_amount: number }>();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dateKey = formatInTimeZone(date, "yyyy-MM-dd", DHAKA_TIME_ZONE);
    recentActivityMap.set(dateKey, { order_count: 0, transaction_amount: 0 });
  }

  visibleSales.forEach((row) => {
    const createdAt = String(row.created_at ?? "");
    if (!createdAt) {
      return;
    }

    const dateKey = formatInTimeZone(new Date(createdAt), "yyyy-MM-dd", DHAKA_TIME_ZONE);
    const entry = recentActivityMap.get(dateKey);
    if (!entry) {
      return;
    }

    entry.order_count += 1;
    entry.transaction_amount += Math.max(0, (Number(row.grand_total ?? 0) || 0) - (Number(row.fee ?? 0) || 0));
  });

  const recent_activity = Array.from(recentActivityMap.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([date, value]) => ({ date, ...value }));

  return {
    ...baseRow,
    customers_count: Number(baseRow.customers_count ?? 0),
    daily_order_quantity: Number(baseRow.daily_order_quantity ?? 0),
    daily_transaction_amount: Number(baseRow.daily_transaction_amount ?? 0),
    products_count: productsCount,
    total_order_quantity: visibleSales.length,
    total_transaction_amount: visibleSales.reduce(
      (sum, row) => sum + Math.max(0, (Number(row.grand_total ?? 0) || 0) - (Number(row.fee ?? 0) || 0)),
      0,
    ),
    week_order_quantity: recent_activity.reduce((sum, row) => sum + row.order_count, 0),
    week_transaction_amount: recent_activity.reduce((sum, row) => sum + row.transaction_amount, 0),
    recent_activity,
  };
};

const getTenantIndex = (tenantId: string) => tenants.findIndex((tenant) => tenant.id === tenantId);

const ensureUniqueTenantEmail = (email: string, currentTenantId?: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const duplicate = tenants.find(
    (tenant) => tenant.tenant_email.toLowerCase() === normalizedEmail && tenant.id !== currentTenantId,
  );

  if (duplicate) {
    throw new Error("A tenant with this email already exists.");
  }
};

const ensureUniqueRole = (roleName: string, tenantId: string) => {
  const normalizedRoleName = roleName.trim().toLowerCase();
  const duplicate = roles.find(
    (role) => role.tenant_id === tenantId && role.role_name.trim().toLowerCase() === normalizedRoleName,
  );

  if (duplicate) {
    throw new Error("This role already exists for the selected tenant.");
  }
};

export const getTenants = async () => {
  let rows: PlatformTenantRow[];

  if (shouldPreferDirectTenantData(configuredApiUrl)) {
    rows = await buildPlatformTenantRowsDirect();
  } else {
    try {
      rows = await invokeProtectedApi<PlatformTenantRow[]>("/platform/super-admin/tenants");
    } catch (error) {
      if (!isTenantApiUnavailable(error)) {
        throw error;
      }
      rows = await buildPlatformTenantRowsDirect();
    }
  }

  const safeRows = Array.isArray(rows) ? rows : [];
  const mapped = safeRows.map(mapPlatformTenant).sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
  tenants = mapped;
  return clone(mapped);
};

export const getTenantById = async (tenantId: string) => {
  let row: PlatformTenantRow;

  if (shouldPreferDirectTenantData(configuredApiUrl)) {
    const rows = await buildPlatformTenantRowsDirect();
    const directRow = rows.find((entry) => entry.tenant_id === tenantId);
    if (!directRow) {
      throw new Error("Tenant not found.");
    }
    row = directRow;
  } else {
    try {
      row = await invokeProtectedApi<PlatformTenantRow>(`/platform/super-admin/tenants/${tenantId}`);
    } catch (error) {
      if (!isTenantApiUnavailable(error)) {
        throw error;
      }
      const rows = await buildPlatformTenantRowsDirect();
      const directRow = rows.find((entry) => entry.tenant_id === tenantId);
      if (!directRow) {
        throw new Error("Tenant not found.");
      }
      row = directRow;
    }
  }

  const mapped = mapPlatformTenant(row);
  return clone(mapped);
};

export const getTenantDetail = async (tenantId: string) => {
  let row: PlatformTenantDetail;

  if (shouldPreferDirectTenantData(configuredApiUrl)) {
    row = await buildPlatformTenantDetailDirect(tenantId);
  } else {
    try {
      row = await invokeProtectedApi<PlatformTenantDetail>(`/platform/super-admin/tenants/${tenantId}`);
    } catch (error) {
      if (!isTenantApiUnavailable(error)) {
        throw error;
      }
      row = await buildPlatformTenantDetailDirect(tenantId);
    }
  }

  const mapped = mapPlatformTenantDetail(row);
  return clone(mapped);
};

export const createTenantAdmin = async (payload: CreateTenantAdminInput) => {
  return await invokeProtectedFunction<CreateTenantAdminResult>("admin-tenant-create", {
    body: payload,
  });
};

const normalizeBillingPlanKey = (planKey: string | null | undefined): BillingPlanKey => {
  if (planKey === "starter" || planKey === "pro") {
    return planKey;
  }

  return "free";
};

export const getTenantBillingPlan = async (tenantId: string): Promise<TenantBillingPlanRecord> => {
  const { data, error } = await (supabase as any)
    .from("tenant_billing")
    .select("tenant_id, plan_key, status")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load tenant billing plan");
  }

  return {
    tenant_id: tenantId,
    plan_key: normalizeBillingPlanKey(data?.plan_key),
    status: String(data?.status ?? "inactive"),
  };
};

export const updateTenantBillingPlan = async (payload: {
  tenant_id: string;
  plan_key: BillingPlanKey;
}) => {
  return await invokeProtectedFunction<{
    success: boolean;
    tenant_id: string;
    plan_key: BillingPlanKey;
  }>("admin-tenant-package-update", {
    body: payload,
  });
};

export const validateTenantContact = async (payload: {
  admin_email?: string;
  admin_phone?: string;
}) => {
  return await invokeProtectedFunction<TenantContactValidationResult>("admin-tenant-create", {
    body: { action: "validate_contact", ...payload },
  });
};

export const createTenant = async (payload: TenantInput) => {
  await delay();
  ensureUniqueTenantEmail(payload.tenant_email);

  const nextTenant: TenantRecord = {
    id: `tenant-${tenantSequence += 1}`,
    tenant_name: payload.tenant_name.trim(),
    tenant_email: payload.tenant_email.trim(),
    password: payload.password,
    tenant_status: payload.tenant_status,
    users_count: 1,
    customers_count: 0,
    created_at: new Date().toISOString(),
    deleted_at: null,
  };

  tenants = [nextTenant, ...tenants];

  employees = [
    {
      id: `employee-${employeeSequence += 1}`,
      tenant_id: nextTenant.id,
      name: `${payload.tenant_name.trim()} Admin`,
      email: payload.tenant_email.trim(),
      role: "Tenant Admin",
      status: payload.tenant_status,
      joined_at: new Date().toISOString(),
    },
    ...employees,
  ];

  return clone(nextTenant);
};

export const updateTenant = async (tenantId: string, payload: TenantInput) => {
  await delay();
  ensureUniqueTenantEmail(payload.tenant_email, tenantId);

  const tenantIndex = getTenantIndex(tenantId);
  if (tenantIndex === -1) {
    throw new Error("Tenant not found.");
  }

  tenants[tenantIndex] = {
    ...tenants[tenantIndex],
    tenant_name: payload.tenant_name.trim(),
    tenant_email: payload.tenant_email.trim(),
    password: payload.password,
    tenant_status: payload.tenant_status,
    deleted_at:
      payload.tenant_status === "inactive"
        ? tenants[tenantIndex].deleted_at ?? new Date().toISOString()
        : null,
  };

  employees = employees.map((employee) => {
    if (employee.tenant_id !== tenantId || employee.role !== "Tenant Admin") {
      return employee;
    }

    return {
      ...employee,
      name: `${payload.tenant_name.trim()} Admin`,
      email: payload.tenant_email.trim(),
      status: payload.tenant_status,
    };
  });

  return clone(tenants[tenantIndex]);
};

export const deleteTenant = async (tenantId: string, options: DeleteTenantOptions) => {
  await delay();
  const tenantIndex = getTenantIndex(tenantId);
  if (tenantIndex === -1) {
    throw new Error("Tenant not found.");
  }

  const tenant = tenants[tenantIndex];

  if (options.mode === "soft") {
    tenants[tenantIndex] = {
      ...tenant,
      tenant_status: "inactive",
      deleted_at: new Date().toISOString(),
    };

    employees = employees.map((employee) =>
      employee.tenant_id === tenantId ? { ...employee, status: "inactive" } : employee,
    );

    return clone(tenants[tenantIndex]);
  }

  tenants = tenants.filter((entry) => entry.id !== tenantId);
  roles = roles.filter((role) => role.tenant_id !== tenantId);
  employees = employees.filter((employee) => employee.tenant_id !== tenantId);

  return clone(tenant);
};

export const getRoles = async () => {
  await delay();
  return clone(
    [...roles].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
  );
};

export const createRole = async (payload: TenantRoleInput) => {
  await delay();
  const tenant = tenants.find((entry) => entry.id === payload.tenant_id);

  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  ensureUniqueRole(payload.role_name, payload.tenant_id);

  const nextRole: TenantRoleRecord = {
    id: `role-${roleSequence += 1}`,
    role_name: payload.role_name.trim(),
    tenant_id: payload.tenant_id,
    permissions: [...payload.permissions].sort(),
    created_at: new Date().toISOString(),
  };

  roles = [nextRole, ...roles];
  return clone(nextRole);
};

export const deleteRole = async (roleId: string) => {
  await delay();
  const role = roles.find((entry) => entry.id === roleId);

  if (!role) {
    throw new Error("Role not found.");
  }

  roles = roles.filter((entry) => entry.id !== roleId);
  employees = employees.map((employee) =>
    employee.role === role.role_name && employee.tenant_id === role.tenant_id
      ? { ...employee, role: "Unassigned" }
      : employee,
  );

  return clone(role);
};

export const getTenantEmployees = async (tenantId: string) => {
  await delay();
  return clone(
    employees
      .filter((employee) => employee.tenant_id === tenantId)
      .sort((left, right) => new Date(right.joined_at).getTime() - new Date(left.joined_at).getTime()),
  );
};

const tenantService = {
  getTenants,
  getTenantById,
  getTenantDetail,
  createTenantAdmin,
  validateTenantContact,
  createTenant,
  updateTenant,
  deleteTenant,
  getRoles,
  createRole,
  deleteRole,
  getTenantEmployees,
};

export default tenantService;
