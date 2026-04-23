import {
  ForbiddenException,
  Injectable,
  NotFoundException,
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

interface ProductTenantRow {
  id: string;
  tenant_id: string;
}

interface ProductWriteData {
  name?: string;
  sku?: string | null;
  rate?: number;
  minimum_sale_price?: number | null;
  cost?: number | null;
  stock_quantity?: number | null;
  low_stock_threshold?: number | null;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
  has_variants?: boolean;
}

interface VariantAttributes {
  [key: string]: string;
}

interface ProductVariantWriteData {
  product_id?: string;
  attributes?: VariantAttributes;
  sku?: string | null;
  rate?: number | null;
  cost?: number | null;
  stock_quantity?: number;
  low_stock_threshold?: number | null;
  image_url?: string | null;
}

interface AttributeDefinition {
  name: string;
  values: string[];
}

interface ProductAttributeValueRow {
  id: string;
  attribute_id?: string | null;
  value: string | null;
}

interface ProductAttributeRow {
  id: string;
  name: string;
  tenant_id?: string | null;
  product_attribute_values?: ProductAttributeValueRow[] | null;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  tenant_id?: string | null;
  attributes: VariantAttributes;
  sku: string | null;
  rate: number | null;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  image_url: string | null;
  woocommerce_id?: number | null;
  woocommerce_connection_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductUpsertPayload {
  id?: string;
  data?: ProductWriteData;
}

export interface ProductVariantsBulkUpsertPayload {
  productId?: string;
  hasVariants?: boolean;
  attributes?: AttributeDefinition[];
  variants?: ProductVariantWriteData[];
}

export interface ProductVariantsClearPayload {
  productId?: string;
}

const PRODUCT_MUTABLE_FIELDS = new Set([
  "name",
  "sku",
  "rate",
  "minimum_sale_price",
  "cost",
  "stock_quantity",
  "low_stock_threshold",
  "size",
  "color",
  "image_url",
  "has_variants",
]);

const PRODUCT_BASE_SELECT = `
  id,
  name,
  sku,
  rate,
  minimum_sale_price,
  cost,
  stock_quantity,
  low_stock_threshold,
  size,
  color,
  image_url,
  has_variants,
  is_deleted,
  deleted_at,
  created_at,
  updated_at,
  created_by
`;

const PRODUCT_BASE_SELECT_LEGACY = `
  id,
  name,
  sku,
  rate,
  cost,
  stock_quantity,
  low_stock_threshold,
  size,
  color,
  image_url,
  has_variants,
  is_deleted,
  deleted_at,
  created_at,
  updated_at,
  created_by
`;

@Injectable()
export class ProductsService {
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

    if (role === "manager") {
      return ["products.view", "products.add", "products.edit"].includes(permissionKey);
    }

    if (role === "staff") {
      return ["products.view", "products.add", "products.edit"].includes(permissionKey);
    }

    return false;
  }

  private normalizeTextInput(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  private normalizeProductData(data: ProductWriteData): ProductWriteData {
    const normalized: ProductWriteData = {};

    for (const [key, value] of Object.entries(data)) {
      if (!PRODUCT_MUTABLE_FIELDS.has(key) || value === undefined) {
        continue;
      }

      if (key === "name") {
        const trimmedName = String(value ?? "").trim();
        if (trimmedName) {
          normalized.name = trimmedName;
        }
        continue;
      }

      if (key === "sku" || key === "size" || key === "color" || key === "image_url") {
        normalized[key as keyof ProductWriteData] = this.normalizeTextInput(
          value as string | null | undefined,
        ) as never;
        continue;
      }

      normalized[key as keyof ProductWriteData] = value as never;
    }

    return normalized;
  }

  private isMissingMinimumSalePriceColumnError(error: unknown): boolean {
    const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
    return message.includes("minimum_sale_price") && message.includes("column");
  }

  private withLegacyMinimumSalePriceFallback<T extends Record<string, unknown>>(row: T): T & {
    minimum_sale_price: number | null;
  } {
    if ("minimum_sale_price" in row) {
      return row as T & { minimum_sale_price: number | null };
    }

    return {
      ...row,
      minimum_sale_price: null,
    };
  }

  private withLegacyMinimumSalePriceFallbackList<T extends Record<string, unknown>>(
    rows: T[] | null | undefined,
  ): Array<T & { minimum_sale_price: number | null }> {
    return (rows ?? []).map((row) => this.withLegacyMinimumSalePriceFallback(row));
  }

  private withoutMinimumSalePrice(payload: Record<string, unknown>): Record<string, unknown> {
    if (!("minimum_sale_price" in payload)) {
      return payload;
    }

    const { minimum_sale_price, ...fallbackPayload } = payload;
    return fallbackPayload;
  }

  private async attachVariantsToProducts<T extends Record<string, unknown> & { id?: unknown }>(
    tenantId: string,
    rows: T[] | null | undefined,
  ): Promise<Array<T & { product_variants: ProductVariantRow[] }>> {
    const products = rows ?? [];
    if (products.length === 0) {
      return [];
    }

    const productIds = products
      .map((row) => String(row.id ?? "").trim())
      .filter(Boolean);

    if (productIds.length === 0) {
      return products.map((row) => ({
        ...row,
        product_variants: [],
      }));
    }

    const admin = this.getAdminClient();
    const { data, error } = await admin
      .from("product_variants")
      .select(`
        id,
        product_id,
        attributes,
        sku,
        rate,
        cost,
        stock_quantity,
        low_stock_threshold,
        image_url,
        created_at,
        updated_at
      `)
      .eq("tenant_id", tenantId)
      .in("product_id", productIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load product variants");
    }

    const variantsByProductId = new Map<string, ProductVariantRow[]>();
    for (const variant of (data ?? []) as ProductVariantRow[]) {
      const productId = String(variant.product_id ?? "").trim();
      if (!productId) {
        continue;
      }

      const existing = variantsByProductId.get(productId) ?? [];
      existing.push(variant);
      variantsByProductId.set(productId, existing);
    }

    return products.map((row) => ({
      ...row,
      product_variants: variantsByProductId.get(String(row.id ?? "").trim()) ?? [],
    }));
  }

  private normalizeAttributes(attributes: VariantAttributes): string {
    const sortedKeys = Object.keys(attributes).sort();
    const normalized = sortedKeys.reduce((acc, key) => {
      acc[key] = attributes[key];
      return acc;
    }, {} as VariantAttributes);
    return JSON.stringify(normalized);
  }

  private normalizeAttributeValues(values: Array<string | null | undefined>): string[] {
    const seen = new Map<string, string>();

    values.forEach((value) => {
      const normalized = String(value ?? "").trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, normalized);
      }
    });

    return Array.from(seen.values());
  }

  private async loadProductAttributesWithValues(
    admin: SupabaseClient,
    productId: string,
    tenantId: string,
  ): Promise<ProductAttributeRow[]> {
    const { data: attributeRows, error: attributesError } = await admin
      .from("product_attributes")
      .select("id, name, tenant_id")
      .eq("product_id", productId)
      .eq("tenant_id", tenantId);

    if (attributesError) {
      throw new Error(attributesError.message || "Failed to load product attributes");
    }

    const attributes = (attributeRows ?? []) as ProductAttributeRow[];
    if (attributes.length === 0) {
      return [];
    }

    const { data: valueRows, error: valuesError } = await admin
      .from("product_attribute_values")
      .select("id, attribute_id, value")
      .eq("tenant_id", tenantId)
      .in(
        "attribute_id",
        attributes.map((attribute) => attribute.id),
      );

    if (valuesError) {
      throw new Error(valuesError.message || "Failed to load product attribute values");
    }

    const valuesByAttributeId = new Map<string, ProductAttributeValueRow[]>();
    ((valueRows ?? []) as ProductAttributeValueRow[]).forEach((row) => {
      const attributeId = String(row.attribute_id ?? "").trim();
      if (!attributeId) {
        return;
      }

      const normalizedValue = String(row.value ?? "").trim();
      if (!normalizedValue) {
        return;
      }

      const existing = valuesByAttributeId.get(attributeId) ?? [];
      existing.push({
        id: row.id,
        attribute_id: attributeId,
        value: normalizedValue,
      });
      valuesByAttributeId.set(attributeId, existing);
    });

    return attributes.map((attribute) => ({
      ...attribute,
      product_attribute_values: valuesByAttributeId.get(attribute.id) ?? [],
    }));
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

  private async ensureAnyPermission(tenantId: string, role: string, permissionKeys: string[]) {
    for (const permissionKey of permissionKeys) {
      try {
        await this.ensurePermission(tenantId, role, permissionKey);
        return;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) {
          throw error;
        }
      }
    }

    throw new ForbiddenException(`Missing permission: ${permissionKeys.join(" or ")}`);
  }

  private async ensureProductInTenant(productId: string, tenantId: string): Promise<ProductTenantRow> {
    const admin = this.getAdminClient();
    const { data, error } = await admin
      .from("products")
      .select("id, tenant_id")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load product");
    }

    if (!data?.id) {
      throw new NotFoundException("Product not found in your tenant");
    }

    return data as ProductTenantRow;
  }

  async listProducts(userId: string) {
    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "products.view");

    const admin = this.getAdminClient();
    const primaryResult = await admin
      .from("products")
      .select(PRODUCT_BASE_SELECT)
      .eq("tenant_id", actorContext.tenantId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (!primaryResult.error) {
      const products = this.withLegacyMinimumSalePriceFallbackList(
        primaryResult.data as Record<string, unknown>[] | null,
      );
      return this.attachVariantsToProducts(actorContext.tenantId, products);
    }

    if (this.isMissingMinimumSalePriceColumnError(primaryResult.error)) {
      const fallbackResult = await admin
        .from("products")
        .select(PRODUCT_BASE_SELECT_LEGACY)
        .eq("tenant_id", actorContext.tenantId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message || "Failed to load products");
      }

      const products = this.withLegacyMinimumSalePriceFallbackList(
        fallbackResult.data as Record<string, unknown>[] | null,
      );
      return this.attachVariantsToProducts(actorContext.tenantId, products);
    }

    throw new Error(primaryResult.error.message || "Failed to load products");
  }

  async upsertProduct(input: { userId: string; payload: ProductUpsertPayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    const payload = input.payload ?? {};
    const productId = String(payload.id ?? "").trim() || null;
    const normalizedData = this.normalizeProductData(payload.data ?? {});

    if (productId) {
      await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "products.edit");
      await this.ensureProductInTenant(productId, actorContext.tenantId);

      const admin = this.getAdminClient();
      const updatePayload: Record<string, unknown> = { ...normalizedData };
      const primaryResult = await admin
        .from("products")
        .update(updatePayload)
        .eq("id", productId)
        .eq("tenant_id", actorContext.tenantId)
        .select(PRODUCT_BASE_SELECT)
        .single();

      if (!primaryResult.error) {
        const products = await this.attachVariantsToProducts(actorContext.tenantId, [
          this.withLegacyMinimumSalePriceFallback(primaryResult.data as Record<string, unknown>),
        ]);
        return products[0];
      }

      if (this.isMissingMinimumSalePriceColumnError(primaryResult.error)) {
        const fallbackPayload = this.withoutMinimumSalePrice(updatePayload);
        const fallbackResult = await admin
          .from("products")
          .update(fallbackPayload)
          .eq("id", productId)
          .eq("tenant_id", actorContext.tenantId)
          .select(PRODUCT_BASE_SELECT_LEGACY)
          .single();

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message || "Failed to update product");
        }

        const products = await this.attachVariantsToProducts(actorContext.tenantId, [
          this.withLegacyMinimumSalePriceFallback(fallbackResult.data as Record<string, unknown>),
        ]);
        return products[0];
      }

      throw new Error(primaryResult.error.message || "Failed to update product");
    }

    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "products.add");

    if (!normalizedData.name) {
      throw new ForbiddenException("Product name is required");
    }

    const admin = this.getAdminClient();
    const createPayload: Record<string, unknown> = {
      ...normalizedData,
      created_by: userId,
      tenant_id: actorContext.tenantId,
    };
    const primaryResult = await admin
      .from("products")
      .insert(createPayload)
      .select(PRODUCT_BASE_SELECT)
      .single();

    if (!primaryResult.error) {
      const products = await this.attachVariantsToProducts(actorContext.tenantId, [
        this.withLegacyMinimumSalePriceFallback(primaryResult.data as Record<string, unknown>),
      ]);
      return products[0];
    }

    if (this.isMissingMinimumSalePriceColumnError(primaryResult.error)) {
      const fallbackPayload = this.withoutMinimumSalePrice(createPayload);
      const fallbackResult = await admin
        .from("products")
        .insert(fallbackPayload)
        .select(PRODUCT_BASE_SELECT_LEGACY)
        .single();

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message || "Failed to create product");
      }

      const products = await this.attachVariantsToProducts(actorContext.tenantId, [
        this.withLegacyMinimumSalePriceFallback(fallbackResult.data as Record<string, unknown>),
      ]);
      return products[0];
    }

    throw new Error(primaryResult.error.message || "Failed to create product");
  }

  async listProductVariants(input: { userId: string; productId: string }) {
    const userId = String(input.userId ?? "").trim();
    const productId = String(input.productId ?? "").trim();

    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    if (!productId) {
      throw new ForbiddenException("Product id is required");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "products.view");
    await this.ensureProductInTenant(productId, actorContext.tenantId);

    const admin = this.getAdminClient();
    const { data, error } = await admin
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .eq("tenant_id", actorContext.tenantId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load product variants");
    }

    return data ?? [];
  }

  async bulkUpsertVariants(input: { userId: string; payload: ProductVariantsBulkUpsertPayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensureAnyPermission(actorContext.tenantId, actorContext.appRole, ["products.edit", "products.add"]);

    const payload = input.payload ?? {};
    const productId = String(payload.productId ?? "").trim();
    const hasVariants = Boolean(payload.hasVariants);
    const attributes = Array.isArray(payload.attributes) ? payload.attributes : [];
    const variants = Array.isArray(payload.variants) ? payload.variants : [];

    if (!productId) {
      throw new ForbiddenException("Product id is required");
    }

    await this.ensureProductInTenant(productId, actorContext.tenantId);
    const admin = this.getAdminClient();

    const { error: productUpdateError } = await admin
      .from("products")
      .update({ has_variants: hasVariants })
      .eq("id", productId)
      .eq("tenant_id", actorContext.tenantId);

    if (productUpdateError) {
      throw new Error(productUpdateError.message || "Failed to update product variant state");
    }

    const validAttributes = attributes.filter((attribute) => {
      const name = String(attribute?.name ?? "").trim();
      return Boolean(name) && (!attribute?.values || Array.isArray(attribute.values));
    });

    if (validAttributes.length > 0) {
      const existingAttrs = await this.loadProductAttributesWithValues(
        admin,
        productId,
        actorContext.tenantId,
      );

      const existingAttrsMap = new Map(
        existingAttrs.map((attribute) => [
          String(attribute.name ?? "").toLowerCase().trim(),
          {
            id: attribute.id,
            existingValues: new Set(
              this.normalizeAttributeValues(
                (attribute.product_attribute_values ?? []).map((valueRow) => valueRow.value),
              ),
            ),
          },
        ]),
      );

      for (const attribute of validAttributes) {
        const normalizedName = String(attribute.name ?? "").trim();
        const lookupKey = normalizedName.toLowerCase();
        const existingAttr = existingAttrsMap.get(lookupKey);
        let attributeId = existingAttr?.id ?? null;

        if (!attributeId) {
          const createAttribute = await admin
            .from("product_attributes")
            .insert({
              product_id: productId,
              name: normalizedName,
              tenant_id: actorContext.tenantId,
            })
            .select("id")
            .single();

          if (createAttribute.error) {
            if (createAttribute.error.code === "23505") {
              const existingAttribute = await admin
                .from("product_attributes")
                .select("id")
                .eq("product_id", productId)
                .eq("tenant_id", actorContext.tenantId)
                .eq("name", normalizedName)
                .single();

              if (existingAttribute.error) {
                throw new Error(existingAttribute.error.message || "Failed to resolve duplicate attribute");
              }

              attributeId = existingAttribute.data.id;
            } else {
              throw new Error(createAttribute.error.message || "Failed to create product attribute");
            }
          } else {
            attributeId = createAttribute.data.id;
          }
        }

        const desiredValues = Array.isArray(attribute.values)
          ? attribute.values.map((value) => String(value ?? "").trim()).filter(Boolean)
          : [];
        const existingValues = existingAttr?.existingValues ?? new Set<string>();
        const valuesToInsert = desiredValues.filter((value) => !existingValues.has(value));

        if (valuesToInsert.length > 0) {
          const { error: insertValuesError } = await admin
            .from("product_attribute_values")
            .insert(
              valuesToInsert.map((value) => ({
                attribute_id: attributeId,
                value,
                tenant_id: actorContext.tenantId,
              })),
            );

          if (insertValuesError && insertValuesError.code !== "23505") {
            throw new Error(insertValuesError.message || "Failed to create product attribute values");
          }
        }
      }
    }

    if (attributes.length > 0) {
      const finalAttrs = await this.loadProductAttributesWithValues(
        admin,
        productId,
        actorContext.tenantId,
      );

      const validAttributeNames = new Set(
        attributes.map((attribute) => String(attribute.name ?? "").toLowerCase().trim()).filter(Boolean),
      );
      const validAttrValues = new Map<string, Set<string>>();
      attributes.forEach((attribute) => {
        validAttrValues.set(
          String(attribute.name ?? "").toLowerCase().trim(),
          new Set(this.normalizeAttributeValues(attribute.values ?? [])),
        );
      });

      for (const attribute of finalAttrs) {
        const normalizedName = String(attribute.name ?? "").toLowerCase().trim();
        const attributeValues = attribute.product_attribute_values ?? [];

        if (!validAttributeNames.has(normalizedName)) {
          if (attributeValues.length > 0) {
            const { error: deleteValuesError } = await admin
              .from("product_attribute_values")
              .delete()
              .eq("tenant_id", actorContext.tenantId)
              .in(
                "id",
                attributeValues.map((valueRow) => valueRow.id),
              );

            if (deleteValuesError) {
              throw new Error(deleteValuesError.message || "Failed to delete obsolete attribute values");
            }
          }

          const { error: deleteAttrError } = await admin
            .from("product_attributes")
            .delete()
            .eq("id", attribute.id)
            .eq("tenant_id", actorContext.tenantId);

          if (deleteAttrError) {
            throw new Error(deleteAttrError.message || "Failed to delete obsolete attribute");
          }

          continue;
        }

        const allowedValues = validAttrValues.get(normalizedName) ?? new Set<string>();
        const unusedValues = attributeValues.filter(
          (valueRow) => !allowedValues.has(String(valueRow.value ?? "").trim()),
        );

        if (unusedValues.length > 0) {
          const { error: deleteUnusedValuesError } = await admin
            .from("product_attribute_values")
            .delete()
            .eq("tenant_id", actorContext.tenantId)
            .in(
              "id",
              unusedValues.map((valueRow) => valueRow.id),
            );

          if (deleteUnusedValuesError) {
            throw new Error(deleteUnusedValuesError.message || "Failed to delete unused attribute values");
          }
        }
      }
    } else if (attributes.length === 0) {
      const { data: existingAttrs, error: existingAttrsError } = await admin
        .from("product_attributes")
        .select("id")
        .eq("product_id", productId)
        .eq("tenant_id", actorContext.tenantId);

      if (existingAttrsError) {
        throw new Error(existingAttrsError.message || "Failed to load existing attributes");
      }

      if ((existingAttrs ?? []).length > 0) {
        const attributeIds = (existingAttrs ?? []).map((row) => row.id);

        const { error: deleteValuesError } = await admin
          .from("product_attribute_values")
          .delete()
          .eq("tenant_id", actorContext.tenantId)
          .in("attribute_id", attributeIds);

        if (deleteValuesError) {
          throw new Error(deleteValuesError.message || "Failed to delete attribute values");
        }

        const { error: deleteAttributesError } = await admin
          .from("product_attributes")
          .delete()
          .eq("tenant_id", actorContext.tenantId)
          .eq("product_id", productId);

        if (deleteAttributesError) {
          throw new Error(deleteAttributesError.message || "Failed to delete attributes");
        }
      }
    }

    if (variants.length > 0) {
      const normalizedVariants = variants.map((variant) => {
        const attributesObject = (variant.attributes ?? {}) as VariantAttributes;
        return {
          ...variant,
          product_id: productId,
          attributes: attributesObject,
          normalizedAttributes: this.normalizeAttributes(attributesObject),
        };
      });

      const uniqueVariants = Array.from(
        new Map(
          normalizedVariants.map((variant) => [variant.normalizedAttributes, variant]),
        ).values(),
      );

      const { data: existingVariants, error: existingVariantsError } = await admin
        .from("product_variants")
        .select("id, woocommerce_id, woocommerce_connection_id, attributes")
        .eq("product_id", productId)
        .eq("tenant_id", actorContext.tenantId);

      if (existingVariantsError) {
        throw new Error(existingVariantsError.message || "Failed to load existing variants");
      }

      const normalizedExistingVariants = ((existingVariants ?? []) as ProductVariantRow[]).map((variant) => ({
        ...variant,
        normalizedAttributes: this.normalizeAttributes((variant.attributes ?? {}) as VariantAttributes),
      }));
      const existingVariantsMap = new Map(
        normalizedExistingVariants.map((variant) => [variant.normalizedAttributes, variant]),
      );

      const variantsToInsert: Array<Record<string, unknown>> = [];
      const variantsToUpdate: Array<Record<string, unknown>> = [];

      for (const variant of uniqueVariants) {
        const existingVariant = existingVariantsMap.get(variant.normalizedAttributes);
        const payload = {
          product_id: productId,
          tenant_id: actorContext.tenantId,
          attributes: variant.attributes,
          sku: this.normalizeTextInput(variant.sku),
          rate: variant.rate ?? null,
          cost: variant.cost ?? null,
          stock_quantity: Number(variant.stock_quantity ?? 0) || 0,
          low_stock_threshold: variant.low_stock_threshold ?? null,
          image_url: this.normalizeTextInput(variant.image_url),
          woocommerce_id: existingVariant?.woocommerce_id ?? null,
          woocommerce_connection_id: existingVariant?.woocommerce_connection_id ?? null,
        };

        if (existingVariant?.id) {
          variantsToUpdate.push({
            ...payload,
            id: existingVariant.id,
          });
        } else {
          variantsToInsert.push(payload);
        }
      }

      const newAttributeKeys = new Set(uniqueVariants.map((variant) => variant.normalizedAttributes));
      const variantsToDelete = normalizedExistingVariants.filter(
        (variant) => !newAttributeKeys.has(variant.normalizedAttributes),
      );

      if (variantsToDelete.length > 0) {
        const { error: deleteVariantsError } = await admin
          .from("product_variants")
          .delete()
          .eq("tenant_id", actorContext.tenantId)
          .in(
            "id",
            variantsToDelete.map((variant) => variant.id),
          );

        if (deleteVariantsError) {
          throw new Error(deleteVariantsError.message || "Failed to delete obsolete variants");
        }
      }

      if (variantsToInsert.length > 0) {
        const { error: insertVariantsError } = await admin
          .from("product_variants")
          .insert(variantsToInsert);

        if (insertVariantsError) {
          throw new Error(insertVariantsError.message || "Failed to insert variants");
        }
      }

      if (variantsToUpdate.length > 0) {
        const { error: updateVariantsError } = await admin
          .from("product_variants")
          .upsert(variantsToUpdate, {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (updateVariantsError) {
          throw new Error(updateVariantsError.message || "Failed to update variants");
        }
      }
    } else if (!hasVariants) {
      const { error: deleteVariantsError } = await admin
        .from("product_variants")
        .delete()
        .eq("product_id", productId)
        .eq("tenant_id", actorContext.tenantId);

      if (deleteVariantsError) {
        throw new Error(deleteVariantsError.message || "Failed to clear variants");
      }
    }

    return { success: true };
  }

  async clearVariants(input: { userId: string; payload: ProductVariantsClearPayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "products.edit");

    const productId = String(input.payload?.productId ?? "").trim();
    if (!productId) {
      throw new ForbiddenException("Product id is required");
    }

    await this.ensureProductInTenant(productId, actorContext.tenantId);
    const admin = this.getAdminClient();

    const { error: deleteVariantsError } = await admin
      .from("product_variants")
      .delete()
      .eq("product_id", productId)
      .eq("tenant_id", actorContext.tenantId);

    if (deleteVariantsError) {
      throw new Error(deleteVariantsError.message || "Failed to delete variants");
    }

    const { data: existingAttrs, error: existingAttrsError } = await admin
      .from("product_attributes")
      .select("id")
      .eq("product_id", productId)
      .eq("tenant_id", actorContext.tenantId);

    if (existingAttrsError) {
      throw new Error(existingAttrsError.message || "Failed to load product attributes");
    }

    const attributeIds = (existingAttrs ?? []).map((row) => row.id);
    if (attributeIds.length > 0) {
      const { error: deleteValuesError } = await admin
        .from("product_attribute_values")
        .delete()
        .eq("tenant_id", actorContext.tenantId)
        .in("attribute_id", attributeIds);

      if (deleteValuesError) {
        throw new Error(deleteValuesError.message || "Failed to delete product attribute values");
      }
    }

    const { error: deleteAttrsError } = await admin
      .from("product_attributes")
      .delete()
      .eq("product_id", productId)
      .eq("tenant_id", actorContext.tenantId);

    if (deleteAttrsError) {
      throw new Error(deleteAttrsError.message || "Failed to delete product attributes");
    }

    const { error: updateProductError } = await admin
      .from("products")
      .update({ has_variants: false })
      .eq("id", productId)
      .eq("tenant_id", actorContext.tenantId);

    if (updateProductError) {
      throw new Error(updateProductError.message || "Failed to update product variant flag");
    }

    return { success: true };
  }
}
