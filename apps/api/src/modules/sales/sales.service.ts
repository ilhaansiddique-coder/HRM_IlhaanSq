import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface MembershipRow {
  tenant_id: string;
  role: string | null;
}

interface RoleRow {
  role: string | null;
}

interface RolePermissionRow {
  allowed: boolean;
}

interface SalePaymentSplit {
  method: string;
  amount: number;
}

type SaleRecord = Record<string, unknown>;
type SaleItemRecord = Record<string, unknown>;

export interface SaleCreatePayload {
  sale?: SaleRecord;
  items?: SaleItemRecord[];
  paymentSplits?: SalePaymentSplit[];
}

export interface SaleStatusUpdatePayload {
  saleId?: string;
  update?: Record<string, unknown>;
}

const SALES_CREDIT_TERM_FIELDS = ["payment_terms", "credit_days", "due_date"] as const;
const SALE_STATUS_SELECT = "id, courier_status, payment_status, amount_paid, amount_due";
const ALLOWED_STATUS_UPDATE_FIELDS = new Set([
  "courier_status",
  "order_status",
  "last_status_check",
  "cn_number",
  "consignment_id",
  "payment_status",
  "amount_paid",
  "amount_due",
  "status_backup_payment_status",
  "status_backup_amount_paid",
  "status_backup_amount_due",
]);
const NUMERIC_STATUS_UPDATE_FIELDS = new Set([
  "amount_paid",
  "amount_due",
  "status_backup_amount_paid",
  "status_backup_amount_due",
]);
const NULLABLE_STATUS_STRING_FIELDS = new Set([
  "courier_status",
  "order_status",
  "cn_number",
  "consignment_id",
  "payment_status",
  "status_backup_payment_status",
]);

@Injectable()
export class SalesService {
  private readonly supabaseAdmin: SupabaseClient | null;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL") ?? "";
    const serviceRoleKey = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      this.supabaseAdmin = null;
      return;
    }

    this.supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  private getAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) {
      throw new ServiceUnavailableException("Supabase service role is not configured");
    }

    return this.supabaseAdmin;
  }

  private normalizeRole(role: string | null | undefined): string {
    const normalized = String(role ?? "").trim().toLowerCase();
    if (normalized === "super_admin") return "superadmin";
    if (normalized === "admin") return "tenant_admin";
    return normalized;
  }

  private mapMembershipRoleToAppRole(role: string | null | undefined): string {
    const normalized = this.normalizeRole(role);
    if (normalized === "owner" || normalized === "admin") return "tenant_admin";
    if (normalized === "manager") return "manager";
    if (normalized === "staff") return "staff";
    if (normalized === "member") return "viewer";
    return normalized;
  }

  private getPermissionRoleCandidates(role: string): string[] {
    if (role === "tenant_admin") return ["tenant_admin", "admin"];
    if (role === "store_manager") return ["manager"];
    if (role === "sales_associate" || role === "warehouse") return ["staff"];
    if (role === "member") return ["viewer"];
    return [role];
  }

  private hasDefaultPermission(role: string, permissionKey: string): boolean {
    if (role === "superadmin" || role === "tenant_admin" || role === "admin") {
      return true;
    }

    if (role === "manager" || role === "staff") {
      return permissionKey === "sales.create";
    }

    return false;
  }

  private omitKeys<T extends Record<string, unknown>>(payload: T, keys: string[]): Record<string, unknown> {
    const nextPayload: Record<string, unknown> = { ...payload };
    for (const key of keys) {
      delete nextPayload[key];
    }
    return nextPayload;
  }

  private hasAnyKey(payload: Record<string, unknown>, keys: readonly string[]): boolean {
    return keys.some((key) => key in payload);
  }

  private dedupePayloads<T extends Record<string, unknown>>(payloads: T[]): T[] {
    const seen = new Set<string>();
    const deduped: T[] = [];

    for (const payload of payloads) {
      const signature = JSON.stringify(
        Object.keys(payload)
          .sort()
          .map((key) => [key, payload[key]]),
      );

      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      deduped.push(payload);
    }

    return deduped;
  }

  private buildSalePayloadVariants(payload: Record<string, unknown>): Record<string, unknown>[] {
    const variants = [payload];

    if (this.hasAnyKey(payload, SALES_CREDIT_TERM_FIELDS)) {
      variants.push(this.omitKeys(payload, [...SALES_CREDIT_TERM_FIELDS]));
    }

    if ("tenant_id" in payload) {
      variants.push(this.omitKeys(payload, ["tenant_id"]));
    }

    if ("tenant_id" in payload && this.hasAnyKey(payload, SALES_CREDIT_TERM_FIELDS)) {
      variants.push(this.omitKeys(payload, ["tenant_id", ...SALES_CREDIT_TERM_FIELDS]));
    }

    return this.dedupePayloads(variants);
  }

  private buildTenantAwarePayloadVariants(payload: Record<string, unknown>): Record<string, unknown>[] {
    const variants = [payload];
    if ("tenant_id" in payload) {
      variants.push(this.omitKeys(payload, ["tenant_id"]));
    }
    return this.dedupePayloads(variants);
  }

  private async resolveActorContext(userId: string): Promise<{
    tenantId: string;
    appRole: string;
  }> {
    const admin = this.getAdminClient();

    const [membership, userRole, profileRole] = await Promise.all([
      admin
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (membership.error) {
      throw new UnauthorizedException(
        membership.error.message || "Failed to resolve tenant membership",
      );
    }

    if (!membership.data?.tenant_id) {
      throw new UnauthorizedException("No active tenant membership found");
    }

    if (userRole.error) {
      throw new UnauthorizedException(userRole.error.message || "Failed to resolve user role");
    }

    if (profileRole.error) {
      throw new UnauthorizedException(profileRole.error.message || "Failed to resolve profile role");
    }

    return {
      tenantId: membership.data.tenant_id,
      appRole:
        this.normalizeRole((userRole.data as RoleRow | null)?.role) === "superadmin"
          ? "superadmin"
          : this.normalizeRole((profileRole.data as RoleRow | null)?.role) === "superadmin"
            ? "superadmin"
            : this.mapMembershipRoleToAppRole((membership.data as MembershipRow).role) ||
              this.normalizeRole((userRole.data as RoleRow | null)?.role) ||
              this.normalizeRole((profileRole.data as RoleRow | null)?.role),
    };
  }

  private async ensurePermission(tenantId: string, role: string, permissionKey: string) {
    if (role === "superadmin" || role === "admin" || role === "tenant_admin") {
      return;
    }

    const admin = this.getAdminClient();
    let permissionAllowed: boolean | null = null;
    for (const permissionRole of this.getPermissionRoleCandidates(role)) {
      const tenantPermission = await admin
        .from("tenant_role_permissions")
        .select("allowed")
        .eq("tenant_id", tenantId)
        .eq("role", permissionRole)
        .eq("permission_key", permissionKey)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tenantPermission.error && tenantPermission.error.code !== "PGRST116") {
        throw new ForbiddenException(tenantPermission.error.message || `Failed to resolve ${permissionKey}`);
      }

      if (tenantPermission.data) {
        permissionAllowed = Boolean((tenantPermission.data as RolePermissionRow | null)?.allowed);
        break;
      }

      const globalPermission = await admin
        .from("role_permissions")
        .select("allowed")
        .eq("role", permissionRole)
        .eq("permission_key", permissionKey)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (globalPermission.error && globalPermission.error.code !== "PGRST116") {
        throw new ForbiddenException(globalPermission.error.message || `Failed to resolve ${permissionKey}`);
      }

      if (globalPermission.data) {
        permissionAllowed = Boolean((globalPermission.data as RolePermissionRow | null)?.allowed);
        break;
      }
    }

    if (permissionAllowed === true || this.hasDefaultPermission(role, permissionKey)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permissionKey}`);
  }

  private async insertSaleRecord(
    admin: SupabaseClient,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let lastError: { message?: string } | null = null;

    for (const variant of this.buildSalePayloadVariants(payload)) {
      const result = await admin.from("sales").insert([variant]).select().single();
      if (!result.error) {
        return (result.data as Record<string, unknown>) ?? {};
      }

      lastError = result.error;
    }

    throw new Error(lastError?.message || "Failed to create sale");
  }

  private async insertRowsWithTenantFallback(
    admin: SupabaseClient,
    table: "sales_items" | "sale_payments",
    rows: Record<string, unknown>[],
  ) {
    if (rows.length === 0) {
      return;
    }

    let lastError: { message?: string } | null = null;
    const payloadVariants = this.buildTenantAwarePayloadVariants(rows[0]);

    for (const variant of payloadVariants) {
      const variantRows = rows.map((row) =>
        variant === rows[0] ? row : this.omitKeys(row, ["tenant_id"]),
      );
      const result = await admin.from(table).insert(variantRows);
      if (!result.error) {
        return;
      }

      lastError = result.error;
    }

    throw new Error(lastError?.message || `Failed to insert ${table}`);
  }

  private async repairExistingSaleChildren(
    admin: SupabaseClient,
    saleId: string,
    tenantId: string,
    items: SaleItemRecord[],
    paymentSplits: SalePaymentSplit[],
  ) {
    const existingItems = await admin
      .from("sales_items")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (existingItems.error) {
      throw new Error(existingItems.error.message || "Failed to load existing sale items");
    }

    if ((existingItems.data ?? []).length === 0 && items.length > 0) {
      await this.insertRowsWithTenantFallback(
        admin,
        "sales_items",
        items.map((item) => ({
          ...item,
          sale_id: saleId,
          tenant_id: tenantId,
        })),
      );
    }

    if (paymentSplits.length === 0) {
      return;
    }

    const existingPayments = await admin
      .from("sale_payments")
      .select("id")
      .eq("sale_id", saleId)
      .limit(1);

    if (existingPayments.error) {
      throw new Error(existingPayments.error.message || "Failed to load existing payments");
    }

    if ((existingPayments.data ?? []).length === 0) {
      await this.insertRowsWithTenantFallback(
        admin,
        "sale_payments",
        paymentSplits.map((split) => ({
          sale_id: saleId,
          method: split.method,
          amount: split.amount,
          tenant_id: tenantId,
        })),
      );
    }
  }

  private async cleanupFailedSale(admin: SupabaseClient, saleId: string) {
    await admin.from("sale_payments").delete().eq("sale_id", saleId);
    await admin.from("sales_items").delete().eq("sale_id", saleId);
    await admin.from("sales").delete().eq("id", saleId);
  }

  private sanitizeSaleStatusUpdate(update: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new BadRequestException("Update payload is required");
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, rawValue] of Object.entries(update)) {
      if (!ALLOWED_STATUS_UPDATE_FIELDS.has(key)) {
        continue;
      }

      if (NUMERIC_STATUS_UPDATE_FIELDS.has(key)) {
        if (rawValue === null) {
          sanitized[key] = null;
          continue;
        }

        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
          throw new BadRequestException(`Invalid numeric value for ${key}`);
        }

        sanitized[key] = numericValue;
        continue;
      }

      if (NULLABLE_STATUS_STRING_FIELDS.has(key)) {
        if (rawValue === null) {
          sanitized[key] = null;
          continue;
        }

        const stringValue = String(rawValue ?? "").trim();
        sanitized[key] = stringValue.length > 0 ? stringValue : null;
        continue;
      }

      sanitized[key] = rawValue;
    }

    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException("No supported sales status fields were provided");
    }

    return sanitized;
  }

  async createSale(input: { userId: string; payload: SaleCreatePayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "sales.create");

    const admin = this.getAdminClient();
    const payload = input.payload ?? {};
    const sale = { ...(payload.sale ?? {}) };
    const saleId = String(sale.id ?? "").trim();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const paymentSplits = Array.isArray(payload.paymentSplits) ? payload.paymentSplits : [];

    if (!saleId) {
      throw new ForbiddenException("Sale id is required");
    }

    const existingSale = await admin.from("sales").select("*").eq("id", saleId).maybeSingle();
    if (existingSale.error && existingSale.error.code !== "PGRST116") {
      throw new Error(existingSale.error.message || "Failed to load existing sale");
    }

    if (existingSale.data) {
      const existingTenantId =
        typeof existingSale.data.tenant_id === "string" ? existingSale.data.tenant_id : null;
      if (existingTenantId && existingTenantId !== actorContext.tenantId) {
        throw new ForbiddenException("Sale belongs to another tenant");
      }

      await this.repairExistingSaleChildren(
        admin,
        saleId,
        actorContext.tenantId,
        items,
        paymentSplits,
      );

      return existingSale.data;
    }

    if (!String(sale.invoice_number ?? "").trim()) {
      throw new ForbiddenException("Invoice number is required");
    }

    if (!String(sale.customer_name ?? "").trim()) {
      throw new ForbiddenException("Customer name is required");
    }

    const salePayload = {
      ...sale,
      created_by: userId,
      tenant_id: actorContext.tenantId,
    };

    let created = false;
    try {
      const createdSale = await this.insertSaleRecord(admin, salePayload);
      created = true;

      await this.insertRowsWithTenantFallback(
        admin,
        "sales_items",
        items.map((item) => ({
          ...item,
          sale_id: saleId,
          tenant_id: actorContext.tenantId,
        })),
      );

      await this.insertRowsWithTenantFallback(
        admin,
        "sale_payments",
        paymentSplits.map((split) => ({
          sale_id: saleId,
          method: split.method,
          amount: split.amount,
          tenant_id: actorContext.tenantId,
        })),
      );

      return createdSale;
    } catch (error) {
      if (created) {
        await this.cleanupFailedSale(admin, saleId);
      }

      throw error;
    }
  }

  async updateSaleStatus(input: { userId: string; payload: SaleStatusUpdatePayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "sales.edit");

    const payload = input.payload ?? {};
    const saleId = String(payload.saleId ?? "").trim();
    if (!saleId) {
      throw new BadRequestException("Sale id is required");
    }

    const updatePayload = this.sanitizeSaleStatusUpdate(payload.update);
    const admin = this.getAdminClient();

    const existingSale = await admin
      .from("sales")
      .select("id")
      .eq("id", saleId)
      .eq("tenant_id", actorContext.tenantId)
      .maybeSingle();

    if (existingSale.error) {
      throw new Error(existingSale.error.message || "Failed to load sale");
    }

    if (!existingSale.data?.id) {
      throw new NotFoundException("Sale not found in your tenant");
    }

    const updatedSale = await admin
      .from("sales")
      .update(updatePayload)
      .eq("id", saleId)
      .eq("tenant_id", actorContext.tenantId)
      .select(SALE_STATUS_SELECT)
      .maybeSingle();

    if (updatedSale.error) {
      throw new Error(updatedSale.error.message || "Failed to update sale status");
    }

    if (!updatedSale.data) {
      throw new Error("Sale status update was not persisted");
    }

    return updatedSale.data;
  }
}
