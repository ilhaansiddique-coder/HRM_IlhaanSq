import { invokeProtectedApi } from "@/utils/invokeProtectedApi";
import { supabase } from "@/integrations/supabase/client";

export interface ProductServerWriteData {
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

export interface ProductServerVariant {
  id: string;
  product_id: string;
  attributes: Record<string, string>;
  sku: string | null;
  rate: number | null;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  image_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductServerRecord {
  id: string;
  name: string;
  sku: string | null;
  rate: number;
  minimum_sale_price?: number | null;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  size: string | null;
  color: string | null;
  image_url: string | null;
  has_variants: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  product_variants?: ProductServerVariant[];
}

export interface ProductAttributeDefinition {
  name: string;
  values: string[];
}

export interface ProductVariantUpsertData {
  product_id?: string;
  attributes?: Record<string, string>;
  sku?: string | null;
  rate?: number | null;
  cost?: number | null;
  stock_quantity?: number;
  low_stock_threshold?: number | null;
  image_url?: string | null;
}

type LooseRow = Record<string, unknown>;

const PRODUCT_BASE_SELECT =
  "id, name, sku, rate, minimum_sale_price, cost, stock_quantity, low_stock_threshold, size, color, image_url, has_variants, is_deleted, deleted_at, created_at, updated_at, created_by";
const PRODUCT_BASE_SELECT_LEGACY =
  "id, name, sku, rate, cost, stock_quantity, low_stock_threshold, size, color, image_url, has_variants, is_deleted, deleted_at, created_at, updated_at, created_by";
const PRODUCT_VARIANT_SELECT =
  "id, product_id, attributes, sku, rate, cost, stock_quantity, low_stock_threshold, image_url, created_at, updated_at";
const EXISTING_VARIANT_SELECT =
  "id, attributes, woocommerce_id, woocommerce_connection_id";
const PRODUCT_ATTRIBUTE_SELECT = `
  id,
  name
`;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
};

const getApiUnavailableMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  if (/cannot connect to api|failed to fetch|api request failed/i.test(message)) {
    return "Product service is unavailable. Start the API server with `npm run dev`.";
  }
  return message || "Product service request failed";
};

const isProductApiUnavailable = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /service unavailable|statuscode":503|platform db is unavailable|getaddrinfo enotfound|cannot connect to api|failed to fetch|econnrefused|enotfound/i.test(
    message,
  );
};

const shouldSurfaceDirectProductWriteError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("package limit reached") ||
    message.includes("active products allowed") ||
    message.includes("active customers allowed") ||
    message.includes("active sales allowed")
  );
};

const isMissingMinimumSalePriceColumnError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /minimum_sale_price/i.test(message) && /column|schema cache/i.test(message);
};

const normalizeTextInput = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const stripUndefinedFields = <T extends Record<string, unknown>>(value: T): T => {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return Object.fromEntries(entries) as T;
};

const normalizeVariantAttributes = (attributes: unknown): Record<string, string> => {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
  );
};

const normalizeVariantKey = (attributes: Record<string, string>): string => {
  const normalized = Object.keys(attributes)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = attributes[key];
      return acc;
    }, {});
  return JSON.stringify(normalized);
};

const normalizeAttributeValueList = (values: Array<string | null | undefined>) => {
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
};

const normalizeVariantRecord = (record: LooseRow): ProductServerVariant => ({
  id: String(record.id ?? ""),
  product_id: String(record.product_id ?? ""),
  attributes: normalizeVariantAttributes(record.attributes),
  sku: normalizeTextInput(record.sku),
  rate: record.rate === null || record.rate === undefined ? null : Number(record.rate),
  cost: record.cost === null || record.cost === undefined ? null : Number(record.cost),
  stock_quantity: Number(record.stock_quantity ?? 0) || 0,
  low_stock_threshold:
    record.low_stock_threshold === null || record.low_stock_threshold === undefined
      ? null
      : Number(record.low_stock_threshold),
  image_url: normalizeTextInput(record.image_url),
  created_at: record.created_at ? String(record.created_at) : null,
  updated_at: record.updated_at ? String(record.updated_at) : null,
});

const normalizeProductRecord = (
  record: LooseRow,
  productVariants: ProductServerVariant[] = [],
): ProductServerRecord => ({
  id: String(record.id ?? ""),
  name: String(record.name ?? ""),
  sku: normalizeTextInput(record.sku),
  rate: Number(record.rate ?? 0) || 0,
  minimum_sale_price:
    record.minimum_sale_price === null || record.minimum_sale_price === undefined
      ? null
      : Number(record.minimum_sale_price),
  cost: record.cost === null || record.cost === undefined ? null : Number(record.cost),
  stock_quantity: Number(record.stock_quantity ?? 0) || 0,
  low_stock_threshold: Number(record.low_stock_threshold ?? 0) || 0,
  size: normalizeTextInput(record.size),
  color: normalizeTextInput(record.color),
  image_url: normalizeTextInput(record.image_url),
  has_variants: Boolean(record.has_variants),
  is_deleted: Boolean(record.is_deleted),
  deleted_at: record.deleted_at ? String(record.deleted_at) : null,
  created_at: String(record.created_at ?? ""),
  updated_at: String(record.updated_at ?? ""),
  created_by: record.created_by ? String(record.created_by) : null,
  product_variants: productVariants,
});

const resolveCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user ?? null;
};

const resolveCurrentTenantId = async (): Promise<string | null> => {
  const { data, error } = await (supabase as any).rpc("current_tenant_id");
  if (!error && data) {
    return String(data);
  }

  const user = await resolveCurrentUser();
  return (
    (user?.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    (user?.user_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    null
  );
};

const attachVariantsToProductsDirect = async (
  productRows: LooseRow[],
  tenantId: string | null,
): Promise<ProductServerRecord[]> => {
  if (!productRows.length) return [];

  const productIds = productRows
    .map((row) => String(row.id ?? ""))
    .filter(Boolean);

  let variantsQuery = (supabase as any)
    .from("product_variants")
    .select(PRODUCT_VARIANT_SELECT)
    .in("product_id", productIds);

  if (tenantId) {
    variantsQuery = variantsQuery.eq("tenant_id", tenantId);
  }

  const { data: variantRows, error: variantsError } = await variantsQuery;
  if (variantsError) {
    throw new Error(variantsError.message || "Failed to load product variants");
  }

  const variantsByProduct = new Map<string, ProductServerVariant[]>();
  ((variantRows ?? []) as LooseRow[]).forEach((variantRow) => {
    const variant = normalizeVariantRecord(variantRow);
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  });

  return productRows.map((productRow) =>
    normalizeProductRecord(productRow, variantsByProduct.get(String(productRow.id ?? "")) ?? []),
  );
};

const listProductsDirect = async (): Promise<ProductServerRecord[]> => {
  const tenantId = await resolveCurrentTenantId();

  let productsQuery = (supabase as any)
    .from("products")
    .select(PRODUCT_BASE_SELECT)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (tenantId) {
    productsQuery = productsQuery.eq("tenant_id", tenantId);
  }

  let result = await productsQuery;

  if (result.error && isMissingMinimumSalePriceColumnError(result.error)) {
    let legacyQuery = (supabase as any)
      .from("products")
      .select(PRODUCT_BASE_SELECT_LEGACY)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (tenantId) {
      legacyQuery = legacyQuery.eq("tenant_id", tenantId);
    }

    result = await legacyQuery;
  }

  if (result.error) {
    throw new Error(result.error.message || "Failed to load products");
  }

  return attachVariantsToProductsDirect((result.data ?? []) as LooseRow[], tenantId);
};

const buildProductPayload = (data: ProductServerWriteData) =>
  stripUndefinedFields({
    name: normalizeTextInput(data.name) ?? undefined,
    sku: normalizeTextInput(data.sku) ?? null,
    rate: data.rate,
    minimum_sale_price: data.minimum_sale_price ?? null,
    cost: data.cost ?? null,
    stock_quantity: data.stock_quantity,
    low_stock_threshold: data.low_stock_threshold,
    size: normalizeTextInput(data.size) ?? null,
    color: normalizeTextInput(data.color) ?? null,
    image_url: normalizeTextInput(data.image_url) ?? null,
    has_variants: data.has_variants === undefined ? undefined : Boolean(data.has_variants),
  });

const upsertProductDirect = async ({
  id,
  data,
}: {
  id?: string;
  data: ProductServerWriteData;
}): Promise<ProductServerRecord> => {
  const tenantId = await resolveCurrentTenantId();
  const currentUser = await resolveCurrentUser();
  const basePayload = buildProductPayload(data);

  if (id) {
    let updateQuery = (supabase as any)
      .from("products")
      .update(basePayload)
      .eq("id", id)
      .select(PRODUCT_BASE_SELECT)
      .single();

    if (tenantId) {
      updateQuery = updateQuery.eq("tenant_id", tenantId);
    }

    let result = await updateQuery;

    if (result.error && isMissingMinimumSalePriceColumnError(result.error)) {
      const legacyPayload = stripUndefinedFields({
        ...basePayload,
        minimum_sale_price: undefined,
      });

      let legacyQuery = (supabase as any)
        .from("products")
        .update(legacyPayload)
        .eq("id", id)
        .select(PRODUCT_BASE_SELECT_LEGACY)
        .single();

      if (tenantId) {
        legacyQuery = legacyQuery.eq("tenant_id", tenantId);
      }

      result = await legacyQuery;
    }

    if (result.error) {
      throw new Error(result.error.message || "Failed to update product");
    }

    return normalizeProductRecord((result.data ?? {}) as LooseRow);
  }

  const createPayload = stripUndefinedFields({
    ...basePayload,
    created_by: currentUser?.id ?? undefined,
    tenant_id: tenantId ?? undefined,
  });

  let result = await (supabase as any)
    .from("products")
    .insert([createPayload])
    .select(PRODUCT_BASE_SELECT)
    .single();

  if (result.error && isMissingMinimumSalePriceColumnError(result.error)) {
    const legacyPayload = stripUndefinedFields({
      ...createPayload,
      minimum_sale_price: undefined,
    });

    result = await (supabase as any)
      .from("products")
      .insert([legacyPayload])
      .select(PRODUCT_BASE_SELECT_LEGACY)
      .single();
  }

  if (result.error) {
    throw new Error(result.error.message || "Failed to create product");
  }

  return normalizeProductRecord((result.data ?? {}) as LooseRow);
};

const listProductVariantsDirect = async (productId: string): Promise<ProductServerVariant[]> => {
  const tenantId = await resolveCurrentTenantId();
  let query = (supabase as any)
    .from("product_variants")
    .select(PRODUCT_VARIANT_SELECT)
    .eq("product_id", productId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to load product variants");
  }

  return ((data ?? []) as LooseRow[]).map((row) => normalizeVariantRecord(row));
};

const loadProductAttributesDirect = async (productId: string, tenantId: string | null) => {
  let query = (supabase as any)
    .from("product_attributes")
    .select(PRODUCT_ATTRIBUTE_SELECT)
    .eq("product_id", productId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to load product attributes");
  }

  const attributes = (data ?? []) as Array<{
    id: string;
    name: string;
  }>;

  if (attributes.length === 0) {
    return [] as Array<{
      id: string;
      name: string;
      product_attribute_values?: Array<{ id: string; value: string | null }> | null;
    }>;
  }

  let valuesQuery = (supabase as any)
    .from("product_attribute_values")
    .select("id, attribute_id, value")
    .in("attribute_id", attributes.map((attribute) => attribute.id));

  if (tenantId) {
    valuesQuery = valuesQuery.eq("tenant_id", tenantId);
  }

  const { data: valueRows, error: valueError } = await valuesQuery;
  if (valueError) {
    throw new Error(valueError.message || "Failed to load product attribute values");
  }

  const valuesByAttributeId = new Map<string, Array<{ id: string; value: string | null }>>();
  ((valueRows ?? []) as Array<{ id: string; attribute_id: string; value: string | null }>).forEach((row) => {
    const existing = valuesByAttributeId.get(row.attribute_id) ?? [];
    existing.push({
      id: String(row.id ?? ""),
      value: String(row.value ?? "").trim() || null,
    });
    valuesByAttributeId.set(row.attribute_id, existing);
  });

  return attributes.map((attribute) => ({
    ...attribute,
    product_attribute_values: (valuesByAttributeId.get(attribute.id) ?? []).filter((row) => Boolean(row.value)),
  }));
};

const syncProductAttributesDirect = async (
  productId: string,
  attributes: ProductAttributeDefinition[],
  tenantId: string | null,
) => {
  const validAttributes = attributes.filter((attribute) => {
    const name = String(attribute?.name ?? "").trim();
    return Boolean(name) && Array.isArray(attribute.values);
  });

  const existingAttributes = await loadProductAttributesDirect(productId, tenantId);
  const existingMap = new Map(
    existingAttributes.map((attribute) => [
      String(attribute.name ?? "").toLowerCase().trim(),
      {
        id: attribute.id,
        values: new Set(normalizeAttributeValueList((attribute.product_attribute_values ?? []).map((valueRow) => valueRow.value))),
      },
    ]),
  );

  for (const attribute of validAttributes) {
    const normalizedName = String(attribute.name ?? "").trim();
    const lookupKey = normalizedName.toLowerCase();
    const existing = existingMap.get(lookupKey);
    let attributeId = existing?.id ?? null;

    if (!attributeId) {
      const insertPayload = stripUndefinedFields({
        product_id: productId,
        name: normalizedName,
        tenant_id: tenantId ?? undefined,
      });
      const { data, error } = await (supabase as any)
        .from("product_attributes")
        .insert([insertPayload])
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message || "Failed to create product attribute");
      }

      attributeId = String(data?.id ?? "");
    }

    const desiredValues = Array.from(
      new Set((attribute.values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean)),
    );
    const existingValues = existing?.values ?? new Set<string>();
    const valuesToInsert = desiredValues.filter((value) => !existingValues.has(value));

    if (valuesToInsert.length > 0) {
      const insertPayload = valuesToInsert.map((value) =>
        stripUndefinedFields({
          attribute_id: attributeId,
          value,
          tenant_id: tenantId ?? undefined,
        }),
      );

      const { error } = await (supabase as any).from("product_attribute_values").insert(insertPayload);
      if (error) {
        throw new Error(error.message || "Failed to create product attribute values");
      }
    }
  }

  const finalAttributes = await loadProductAttributesDirect(productId, tenantId);
  const validNames = new Set(validAttributes.map((attribute) => String(attribute.name ?? "").toLowerCase().trim()));
  const validValuesByName = new Map(
    validAttributes.map((attribute) => [
      String(attribute.name ?? "").toLowerCase().trim(),
      new Set((attribute.values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean)),
    ]),
  );

  for (const attribute of finalAttributes) {
    const normalizedName = String(attribute.name ?? "").toLowerCase().trim();
    const attributeValues = attribute.product_attribute_values ?? [];

    if (!validNames.has(normalizedName)) {
      if (attributeValues.length > 0) {
        let deleteValuesQuery = (supabase as any)
          .from("product_attribute_values")
          .delete()
          .in(
            "id",
            attributeValues.map((row) => row.id),
          );

        if (tenantId) {
          deleteValuesQuery = deleteValuesQuery.eq("tenant_id", tenantId);
        }

        const { error } = await deleteValuesQuery;
        if (error) {
          throw new Error(error.message || "Failed to delete obsolete attribute values");
        }
      }

      let deleteAttributeQuery = (supabase as any).from("product_attributes").delete().eq("id", attribute.id);
      if (tenantId) {
        deleteAttributeQuery = deleteAttributeQuery.eq("tenant_id", tenantId);
      }

      const { error } = await deleteAttributeQuery;
      if (error) {
        throw new Error(error.message || "Failed to delete obsolete attribute");
      }
      continue;
    }

    const allowedValues = validValuesByName.get(normalizedName) ?? new Set<string>();
    const unusedValues = attributeValues.filter((row) => !allowedValues.has(String(row.value ?? "").trim()));

    if (unusedValues.length > 0) {
      let deleteUnusedValuesQuery = (supabase as any)
        .from("product_attribute_values")
        .delete()
        .in(
          "id",
          unusedValues.map((row) => row.id),
        );

      if (tenantId) {
        deleteUnusedValuesQuery = deleteUnusedValuesQuery.eq("tenant_id", tenantId);
      }

      const { error } = await deleteUnusedValuesQuery;
      if (error) {
        throw new Error(error.message || "Failed to delete unused attribute values");
      }
    }
  }
};

const bulkUpsertProductVariantsDirect = async (payload: {
  productId: string;
  hasVariants: boolean;
  attributes?: ProductAttributeDefinition[];
  variants: ProductVariantUpsertData[];
}): Promise<{ success: boolean }> => {
  const tenantId = await resolveCurrentTenantId();

  let updateProductQuery = (supabase as any)
    .from("products")
    .update({ has_variants: payload.hasVariants })
    .eq("id", payload.productId);

  if (tenantId) {
    updateProductQuery = updateProductQuery.eq("tenant_id", tenantId);
  }

  const { error: productError } = await updateProductQuery;
  if (productError) {
    throw new Error(productError.message || "Failed to update product variant state");
  }

  await syncProductAttributesDirect(payload.productId, payload.attributes ?? [], tenantId);

  const normalizedVariants = Array.from(
    new Map(
      (payload.variants ?? []).map((variant) => {
        const normalizedAttributes = normalizeVariantAttributes(variant.attributes);
        return [
          normalizeVariantKey(normalizedAttributes),
          {
            ...variant,
            attributes: normalizedAttributes,
          },
        ];
      }),
    ).values(),
  );

  let existingVariantsQuery = (supabase as any)
    .from("product_variants")
    .select(EXISTING_VARIANT_SELECT)
    .eq("product_id", payload.productId);

  if (tenantId) {
    existingVariantsQuery = existingVariantsQuery.eq("tenant_id", tenantId);
  }

  const { data: existingVariants, error: existingVariantsError } = await existingVariantsQuery;
  if (existingVariantsError) {
    throw new Error(existingVariantsError.message || "Failed to load existing variants");
  }

  const existingVariantsByKey = new Map(
    ((existingVariants ?? []) as LooseRow[]).map((variant) => {
      const attributes = normalizeVariantAttributes(variant.attributes);
      return [
        normalizeVariantKey(attributes),
        {
          id: String(variant.id ?? ""),
          woocommerce_id: variant.woocommerce_id ?? null,
          woocommerce_connection_id: variant.woocommerce_connection_id ?? null,
        },
      ];
    }),
  );

  const currentKeys = new Set(normalizedVariants.map((variant) => normalizeVariantKey(variant.attributes ?? {})));
  const variantsToDelete = ((existingVariants ?? []) as LooseRow[]).filter((variant) => {
    const key = normalizeVariantKey(normalizeVariantAttributes(variant.attributes));
    return !currentKeys.has(key);
  });

  if (variantsToDelete.length > 0) {
    let deleteVariantsQuery = (supabase as any)
      .from("product_variants")
      .delete()
      .in(
        "id",
        variantsToDelete.map((variant) => String(variant.id ?? "")),
      );

    if (tenantId) {
      deleteVariantsQuery = deleteVariantsQuery.eq("tenant_id", tenantId);
    }

    const { error } = await deleteVariantsQuery;
    if (error) {
      throw new Error(error.message || "Failed to delete obsolete variants");
    }
  }

  const variantsToInsert: LooseRow[] = [];
  const variantsToUpdate: LooseRow[] = [];

  normalizedVariants.forEach((variant) => {
    const normalizedAttributes = normalizeVariantAttributes(variant.attributes);
    const existing = existingVariantsByKey.get(normalizeVariantKey(normalizedAttributes));
    const variantPayload = stripUndefinedFields({
      product_id: payload.productId,
      tenant_id: tenantId ?? undefined,
      attributes: normalizedAttributes,
      sku: normalizeTextInput(variant.sku),
      rate: variant.rate ?? null,
      cost: variant.cost ?? null,
      stock_quantity: Number(variant.stock_quantity ?? 0) || 0,
      low_stock_threshold: variant.low_stock_threshold ?? null,
      image_url: normalizeTextInput(variant.image_url),
      woocommerce_id: existing?.woocommerce_id ?? undefined,
      woocommerce_connection_id: existing?.woocommerce_connection_id ?? undefined,
    });

    if (existing?.id) {
      variantsToUpdate.push({
        ...variantPayload,
        id: existing.id,
      });
      return;
    }

    variantsToInsert.push(variantPayload);
  });

  if (variantsToInsert.length > 0) {
    const { error } = await (supabase as any).from("product_variants").insert(variantsToInsert);
    if (error) {
      throw new Error(error.message || "Failed to insert variants");
    }
  }

  if (variantsToUpdate.length > 0) {
    const { error } = await (supabase as any).from("product_variants").upsert(variantsToUpdate, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (error) {
      throw new Error(error.message || "Failed to update variants");
    }
  }

  if (!payload.hasVariants && normalizedVariants.length === 0) {
    await clearProductVariantsDirect(payload.productId);
  }

  return { success: true };
};

const clearProductVariantsDirect = async (productId: string): Promise<{ success: boolean }> => {
  const tenantId = await resolveCurrentTenantId();

  let deleteVariantsQuery = (supabase as any).from("product_variants").delete().eq("product_id", productId);
  if (tenantId) {
    deleteVariantsQuery = deleteVariantsQuery.eq("tenant_id", tenantId);
  }

  const { error: deleteVariantsError } = await deleteVariantsQuery;
  if (deleteVariantsError) {
    throw new Error(deleteVariantsError.message || "Failed to delete variants");
  }

  const existingAttributes = await loadProductAttributesDirect(productId, tenantId);
  const attributeIds = existingAttributes.map((attribute) => attribute.id);

  if (attributeIds.length > 0) {
    let deleteValuesQuery = (supabase as any)
      .from("product_attribute_values")
      .delete()
      .in("attribute_id", attributeIds);

    if (tenantId) {
      deleteValuesQuery = deleteValuesQuery.eq("tenant_id", tenantId);
    }

    const { error: deleteValuesError } = await deleteValuesQuery;
    if (deleteValuesError) {
      throw new Error(deleteValuesError.message || "Failed to delete product attribute values");
    }
  }

  let deleteAttributesQuery = (supabase as any).from("product_attributes").delete().eq("product_id", productId);
  if (tenantId) {
    deleteAttributesQuery = deleteAttributesQuery.eq("tenant_id", tenantId);
  }

  const { error: deleteAttributesError } = await deleteAttributesQuery;
  if (deleteAttributesError) {
    throw new Error(deleteAttributesError.message || "Failed to delete product attributes");
  }

  let updateProductQuery = (supabase as any)
    .from("products")
    .update({ has_variants: false })
    .eq("id", productId);

  if (tenantId) {
    updateProductQuery = updateProductQuery.eq("tenant_id", tenantId);
  }

  const { error: updateProductError } = await updateProductQuery;
  if (updateProductError) {
    throw new Error(updateProductError.message || "Failed to update product variant flag");
  }

  return { success: true };
};

export const listProductsWithServerAccess = async (): Promise<ProductServerRecord[]> => {
  try {
    return await listProductsDirect();
  } catch (directError) {
    try {
      return await invokeProtectedApi<ProductServerRecord[]>("/products");
    } catch (apiError) {
      if (isProductApiUnavailable(apiError)) {
        throw directError instanceof Error ? directError : new Error(getApiUnavailableMessage(directError));
      }
      throw new Error(getApiUnavailableMessage(apiError));
    }
  }
};

export const upsertProductWithServerAccess = async ({
  id,
  data,
}: {
  id?: string;
  data: ProductServerWriteData;
}): Promise<ProductServerRecord> => {
  try {
    return await upsertProductDirect({ id, data });
  } catch (directError) {
    if (shouldSurfaceDirectProductWriteError(directError)) {
      throw directError instanceof Error ? directError : new Error(getErrorMessage(directError));
    }

    try {
      return await invokeProtectedApi<ProductServerRecord>("/products/upsert", {
        method: "POST",
        body: JSON.stringify({ id, data }),
      });
    } catch (apiError) {
      if (isProductApiUnavailable(apiError)) {
        throw directError instanceof Error ? directError : new Error(getApiUnavailableMessage(directError));
      }
      throw new Error(getApiUnavailableMessage(apiError));
    }
  }
};

export const listProductVariantsWithServerAccess = async (
  productId: string,
): Promise<ProductServerVariant[]> => {
  try {
    return await listProductVariantsDirect(productId);
  } catch (directError) {
    try {
      return await invokeProtectedApi<ProductServerVariant[]>(`/products/${productId}/variants`);
    } catch (apiError) {
      if (isProductApiUnavailable(apiError)) {
        throw directError instanceof Error ? directError : new Error(getApiUnavailableMessage(directError));
      }
      throw new Error(getApiUnavailableMessage(apiError));
    }
  }
};

export const bulkUpsertProductVariantsWithServerAccess = async (payload: {
  productId: string;
  hasVariants: boolean;
  attributes?: ProductAttributeDefinition[];
  variants: ProductVariantUpsertData[];
}): Promise<{ success: boolean }> => {
  try {
    return await bulkUpsertProductVariantsDirect(payload);
  } catch (directError) {
    try {
      return await invokeProtectedApi<{ success: boolean }>("/products/variants/bulk-upsert", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (apiError) {
      if (isProductApiUnavailable(apiError)) {
        throw directError instanceof Error ? directError : new Error(getApiUnavailableMessage(directError));
      }
      throw new Error(getApiUnavailableMessage(apiError));
    }
  }
};

export const clearProductVariantsWithServerAccess = async (
  productId: string,
): Promise<{ success: boolean }> => {
  try {
    return await clearProductVariantsDirect(productId);
  } catch (directError) {
    try {
      return await invokeProtectedApi<{ success: boolean }>("/products/variants/clear", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
    } catch (apiError) {
      if (isProductApiUnavailable(apiError)) {
        throw directError instanceof Error ? directError : new Error(getApiUnavailableMessage(directError));
      }
      throw new Error(getApiUnavailableMessage(apiError));
    }
  }
};
