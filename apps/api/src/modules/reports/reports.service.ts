import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PlatformDbService } from "../../infra/database/platform-db.service";

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

type LooseRow = Record<string, unknown>;

type ReportSaleRow = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_address: string | null;
  courier_name: string | null;
  courier_status: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_terms: string | null;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  review_amount_due: number;
  fee: number;
  created_at: string;
  is_deleted: boolean;
};

type ReportCustomerRow = {
  id: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
};

type ReportProductRow = {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  image_url: string | null;
};

type ReportSalesItemRow = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  variant_image_url: string | null;
  quantity: number;
  total: number;
  source: "sales_items" | "sale_items";
  sales: {
    created_at: string;
    customer_id: string | null;
    customer_name: string;
    invoice_number: string;
    courier_status: string | null;
    payment_status: string | null;
    is_deleted: boolean;
  };
};

type ReportDiagnostics = {
  totalSales: number;
  successfulSales: number;
  cancelledSales: number;
  directSalesItemRows: number;
  legacySaleItemRows: number;
  mergedSalesItemRows: number;
  salesWithItems: number;
  salesWithoutItems: number;
  recoveredFromLegacyItems: number;
  missingItemInvoices: string[];
  warnings: string[];
};

export type CaseStudyDatasetResponse = {
  sales: ReportSaleRow[];
  customers: ReportCustomerRow[];
  products: ReportProductRow[];
  salesItems: ReportSalesItemRow[];
  diagnostics: ReportDiagnostics;
};

const SALES_SELECT = [
  "id",
  "invoice_number",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_whatsapp",
  "customer_address",
  "courier_name",
  "courier_status",
  "payment_method",
  "payment_status",
  "payment_terms",
  "grand_total",
  "amount_paid",
  "amount_due",
  "review_amount_due",
  "fee",
  "created_at",
  "is_deleted",
].join(", ");

const ITEM_SELECT_VARIANTS = [
  "id, sale_id, product_id, product_name, product_image_url, variant_image_url, quantity, total",
  "id, sale_id, product_id, product_name, product_image_url, quantity, total",
  "id, sale_id, product_id, product_name, quantity, total",
];

const CUSTOMER_SELECT = "id, phone, whatsapp, address";
const PRODUCT_SELECT = "id, name, sku, stock_quantity, image_url";
const BATCH_SIZE = 100;

@Injectable()
export class ReportsService {
  private readonly supabaseAdmin: SupabaseClient | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformDb: PlatformDbService,
  ) {
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

    if (permissionKey !== "reports.view") {
      return false;
    }

    return ["manager", "staff", "viewer"].includes(role);
  }

  private async resolveMembership(userId: string): Promise<MembershipRow> {
    const membership = await this.platformDb.queryOne<MembershipRow>(
      `
        SELECT tenant_id, role
        FROM tenant_members
        WHERE user_id = $1
          AND is_active = true
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
      `,
      [userId],
    );

    if (!membership?.tenant_id) {
      throw new UnauthorizedException("No active tenant membership found");
    }

    return membership;
  }

  private async resolveActorContext(userId: string): Promise<{
    tenantId: string;
    appRole: string;
  }> {
    const membership = await this.resolveMembership(userId);

    const [userRole, profileRole] = await Promise.all([
      this.platformDb.queryOne<RoleRow>(
        `
          SELECT role::text AS role
          FROM user_roles
          WHERE user_id = $1
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [userId],
      ),
      this.platformDb.queryOne<RoleRow>(
        `
          SELECT role::text AS role
          FROM profiles
          WHERE id = $1
          LIMIT 1
        `,
        [userId],
      ),
    ]);

    return {
      tenantId: membership.tenant_id,
      appRole:
        this.normalizeRole(userRole?.role) === "superadmin"
          ? "superadmin"
          : this.normalizeRole(profileRole?.role) === "superadmin"
            ? "superadmin"
            : this.mapMembershipRoleToAppRole(membership.role) ||
              this.normalizeRole(userRole?.role) ||
              this.normalizeRole(profileRole?.role),
    };
  }

  private async resolvePermission(
    tenantId: string,
    roleCandidates: string[],
    permissionKey: string,
  ): Promise<boolean | null> {
    const tenantPermission = await this.platformDb.queryOne<RolePermissionRow>(
      `
        SELECT allowed
        FROM tenant_role_permissions
        WHERE tenant_id = $1
          AND role::text = ANY($2)
          AND permission_key = $3
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      [tenantId, roleCandidates, permissionKey],
    );

    if (tenantPermission) {
      return Boolean(tenantPermission.allowed);
    }

    const globalPermission = await this.platformDb.queryOne<RolePermissionRow>(
      `
        SELECT allowed
        FROM role_permissions
        WHERE role::text = ANY($1)
          AND permission_key = $2
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      [roleCandidates, permissionKey],
    );

    if (globalPermission) {
      return Boolean(globalPermission.allowed);
    }

    return null;
  }

  private async ensurePermission(tenantId: string, role: string, permissionKey: string) {
    if (role === "superadmin" || role === "admin" || role === "tenant_admin") {
      return;
    }

    const permission = await this.resolvePermission(
      tenantId,
      this.getPermissionRoleCandidates(role),
      permissionKey,
    );

    if (permission === true || this.hasDefaultPermission(role, permissionKey)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permissionKey}`);
  }

  private parseOptionalDate(value: string | undefined, fieldName: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName} date`);
    }
    return parsed;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private normalizeSaleRow(row: LooseRow): ReportSaleRow {
    return {
      id: String(row.id ?? ""),
      invoice_number: String(row.invoice_number ?? ""),
      customer_id: row.customer_id ? String(row.customer_id) : null,
      customer_name: String(row.customer_name ?? ""),
      customer_phone: row.customer_phone ? String(row.customer_phone) : null,
      customer_whatsapp: row.customer_whatsapp ? String(row.customer_whatsapp) : null,
      customer_address: row.customer_address ? String(row.customer_address) : null,
      courier_name: row.courier_name ? String(row.courier_name) : null,
      courier_status: row.courier_status ? String(row.courier_status) : null,
      payment_method: row.payment_method ? String(row.payment_method) : null,
      payment_status: row.payment_status ? String(row.payment_status) : null,
      payment_terms: row.payment_terms ? String(row.payment_terms) : null,
      grand_total: Number(row.grand_total ?? 0) || 0,
      amount_paid: Number(row.amount_paid ?? 0) || 0,
      amount_due: Number(row.amount_due ?? 0) || 0,
      review_amount_due: Number(row.review_amount_due ?? 0) || 0,
      fee: Number(row.fee ?? 0) || 0,
      created_at: String(row.created_at ?? new Date().toISOString()),
      is_deleted: Boolean(row.is_deleted),
    };
  }

  private normalizeCustomerRow(row: LooseRow): ReportCustomerRow {
    return {
      id: String(row.id ?? ""),
      phone: row.phone ? String(row.phone) : null,
      whatsapp: row.whatsapp ? String(row.whatsapp) : null,
      address: row.address ? String(row.address) : null,
    };
  }

  private normalizeProductRow(row: LooseRow): ReportProductRow {
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      sku: row.sku ? String(row.sku) : null,
      stock_quantity: Number(row.stock_quantity ?? 0) || 0,
      image_url: row.image_url ? String(row.image_url) : null,
    };
  }

  private isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
    const message = String(error?.message ?? "").toLowerCase();
    return (
      error?.code === "42P01" ||
      error?.code === "42703" ||
      message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("column") ||
      message.includes("relation")
    );
  }

  private async selectItemRows(
    admin: SupabaseClient,
    table: "sales_items" | "sale_items",
    saleIds: string[],
  ): Promise<LooseRow[]> {
    if (saleIds.length === 0) {
      return [];
    }

    const rows: LooseRow[] = [];

    for (const batch of this.chunk(saleIds, BATCH_SIZE)) {
      let batchRows: LooseRow[] | null = null;
      let lastError: { code?: string; message?: string } | null = null;

      for (const selectClause of ITEM_SELECT_VARIANTS) {
        const result = await admin.from(table).select(selectClause).in("sale_id", batch);
        if (!result.error) {
          batchRows = (result.data ?? []) as unknown as LooseRow[];
          break;
        }

        lastError = result.error;
        if (!this.isMissingRelationError(result.error)) {
          throw new Error(result.error.message || `Failed to query ${table}`);
        }
      }

      if (!batchRows) {
        if (lastError && !this.isMissingRelationError(lastError)) {
          throw new Error(lastError.message || `Failed to query ${table}`);
        }
        return [];
      }

      rows.push(...batchRows);
    }

    return rows;
  }

  private mergeSalesItems(
    sales: ReportSaleRow[],
    directRows: LooseRow[],
    legacyRows: LooseRow[],
  ): ReportSalesItemRow[] {
    const salesById = new Map(sales.map((sale) => [sale.id, sale]));
    const merged = new Map<string, ReportSalesItemRow>();

    const upsertRows = (rows: LooseRow[], source: "sales_items" | "sale_items") => {
      rows.forEach((row, index) => {
        const saleId = String(row.sale_id ?? "");
        const sale = salesById.get(saleId);
        if (!sale) {
          return;
        }

        const itemId = String(row.id ?? `${source}:${saleId}:${index}`);
        const existing = merged.get(itemId);
        const nextItem: ReportSalesItemRow = {
          id: itemId,
          sale_id: saleId,
          product_id: row.product_id ? String(row.product_id) : null,
          product_name: String(row.product_name ?? ""),
          product_image_url: row.product_image_url ? String(row.product_image_url) : null,
          variant_image_url: row.variant_image_url ? String(row.variant_image_url) : null,
          quantity: Number(row.quantity ?? 0) || 0,
          total: Number(row.total ?? 0) || 0,
          source,
          sales: {
            created_at: sale.created_at,
            customer_id: sale.customer_id,
            customer_name: sale.customer_name,
            invoice_number: sale.invoice_number,
            courier_status: sale.courier_status,
            payment_status: sale.payment_status,
            is_deleted: sale.is_deleted,
          },
        };

        if (!existing) {
          merged.set(itemId, nextItem);
          return;
        }

        merged.set(itemId, {
          ...existing,
          product_id: existing.product_id ?? nextItem.product_id,
          product_name: existing.product_name || nextItem.product_name,
          product_image_url: existing.product_image_url ?? nextItem.product_image_url,
          variant_image_url: existing.variant_image_url ?? nextItem.variant_image_url,
          quantity: existing.quantity || nextItem.quantity,
          total: existing.total || nextItem.total,
          source: existing.source === "sales_items" ? existing.source : nextItem.source,
        });
      });
    };

    upsertRows(directRows, "sales_items");
    upsertRows(legacyRows, "sale_items");

    return Array.from(merged.values());
  }

  private async loadCustomers(
    admin: SupabaseClient,
    customerIds: string[],
  ): Promise<ReportCustomerRow[]> {
    if (customerIds.length === 0) {
      return [];
    }

    const rows: LooseRow[] = [];
    for (const batch of this.chunk(customerIds, BATCH_SIZE)) {
      const result = await admin.from("customers").select(CUSTOMER_SELECT).in("id", batch);
      if (result.error) {
        throw new Error(result.error.message || "Failed to load customers");
      }
      rows.push(...((result.data ?? []) as LooseRow[]));
    }

    return rows.map((row) => this.normalizeCustomerRow(row));
  }

  private async loadProducts(
    admin: SupabaseClient,
    productIds: string[],
  ): Promise<ReportProductRow[]> {
    if (productIds.length === 0) {
      return [];
    }

    const rows: LooseRow[] = [];
    for (const batch of this.chunk(productIds, BATCH_SIZE)) {
      const result = await admin.from("products").select(PRODUCT_SELECT).in("id", batch);
      if (result.error) {
        throw new Error(result.error.message || "Failed to load products");
      }
      rows.push(...((result.data ?? []) as LooseRow[]));
    }

    return rows.map((row) => this.normalizeProductRow(row));
  }

  private isExcludedSale(sale: Pick<ReportSaleRow, "courier_status" | "payment_status">): boolean {
    const courierStatus = String(sale.courier_status ?? "").toLowerCase();
    const paymentStatus = String(sale.payment_status ?? "").toLowerCase();
    return (
      courierStatus.includes("cancel") ||
      courierStatus.includes("return") ||
      courierStatus.includes("lost") ||
      paymentStatus === "cancelled"
    );
  }

  private isSuccessfulSale(sale: Pick<ReportSaleRow, "courier_status" | "payment_status">): boolean {
    if (this.isExcludedSale(sale)) return false;
    const courierStatus = String(sale.courier_status ?? "").toLowerCase();
    const paymentStatus = String(sale.payment_status ?? "").toLowerCase();
    return (
      courierStatus.includes("delivered") ||
      courierStatus.includes("completed") ||
      paymentStatus === "paid" ||
      paymentStatus === "pending" ||
      paymentStatus === "partial"
    );
  }

  private buildDiagnostics(
    sales: ReportSaleRow[],
    directItems: LooseRow[],
    legacyItems: LooseRow[],
    mergedItems: ReportSalesItemRow[],
  ): ReportDiagnostics {
    const directSaleIds = new Set(
      directItems
        .map((row) => String(row.sale_id ?? ""))
        .filter((saleId) => saleId.length > 0),
    );
    const legacySaleIds = new Set(
      legacyItems
        .map((row) => String(row.sale_id ?? ""))
        .filter((saleId) => saleId.length > 0),
    );
    const mergedSaleIds = new Set(mergedItems.map((item) => item.sale_id));
    const missingSales = sales.filter((sale) => !mergedSaleIds.has(sale.id));
    const successfulSales = sales.filter((sale) => this.isSuccessfulSale(sale));
    const cancelledSales = sales.filter((sale) => this.isExcludedSale(sale));
    let recoveredFromLegacyItems = 0;

    sales.forEach((sale) => {
      if (!directSaleIds.has(sale.id) && legacySaleIds.has(sale.id)) {
        recoveredFromLegacyItems += 1;
      }
    });

    const warnings: string[] = [];
    if (sales.length === 0) {
      warnings.push("No booked orders were found in the selected period.");
    }
    if (successfulSales.length === 0 && sales.length > 0) {
      warnings.push(
        "No orders matched the recognized revenue rules. Weekly revenue rhythm and courier revenue mix will remain empty until orders are delivered, completed, paid, pending, or partial.",
      );
    }
    if (missingSales.length > 0) {
      warnings.push(
        `${missingSales.length} booked order${missingSales.length === 1 ? "" : "s"} have no recoverable line items in sales_items or sale_items. Item-based sections will stay incomplete for those orders.`,
      );
    }
    if (recoveredFromLegacyItems > 0) {
      warnings.push(
        `Recovered item movement from legacy sale_items rows for ${recoveredFromLegacyItems} order${recoveredFromLegacyItems === 1 ? "" : "s"}.`,
      );
    }

    return {
      totalSales: sales.length,
      successfulSales: successfulSales.length,
      cancelledSales: cancelledSales.length,
      directSalesItemRows: directItems.length,
      legacySaleItemRows: legacyItems.length,
      mergedSalesItemRows: mergedItems.length,
      salesWithItems: mergedSaleIds.size,
      salesWithoutItems: missingSales.length,
      recoveredFromLegacyItems,
      missingItemInvoices: missingSales
        .map((sale) => sale.invoice_number)
        .filter((invoiceNumber) => invoiceNumber.length > 0)
        .slice(0, 10),
      warnings,
    };
  }

  async getCaseStudyDataset(input: {
    userId: string;
    from?: string;
    to?: string;
  }): Promise<CaseStudyDatasetResponse> {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "reports.view");

    const admin = this.getAdminClient();
    const fromDate = this.parseOptionalDate(input.from, "from");
    const toDate = this.parseOptionalDate(input.to, "to");

    let salesQuery = admin
      .from("sales")
      .select(SALES_SELECT)
      .eq("tenant_id", actorContext.tenantId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (fromDate) {
      salesQuery = salesQuery.gte("created_at", fromDate.toISOString());
    }
    if (toDate) {
      salesQuery = salesQuery.lte("created_at", toDate.toISOString());
    }

    const salesResult = await salesQuery;
    if (salesResult.error) {
      throw new Error(salesResult.error.message || "Failed to load report sales");
    }

    const sales = ((salesResult.data ?? []) as unknown as LooseRow[]).map((row) => this.normalizeSaleRow(row));
    const saleIds = sales.map((sale) => sale.id).filter((saleId) => saleId.length > 0);

    const [directItems, legacyItems] = await Promise.all([
      this.selectItemRows(admin, "sales_items", saleIds),
      this.selectItemRows(admin, "sale_items", saleIds),
    ]);

    const salesItems = this.mergeSalesItems(sales, directItems, legacyItems);

    const customerIds = Array.from(
      new Set(
        sales
          .map((sale) => sale.customer_id)
          .filter((customerId): customerId is string => Boolean(customerId)),
      ),
    );
    const productIds = Array.from(
      new Set(
        salesItems
          .map((item) => item.product_id)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    );

    const [customers, products] = await Promise.all([
      this.loadCustomers(admin, customerIds),
      this.loadProducts(admin, productIds),
    ]);

    return {
      sales,
      customers,
      products,
      salesItems,
      diagnostics: this.buildDiagnostics(sales, directItems, legacyItems, salesItems),
    };
  }
}
