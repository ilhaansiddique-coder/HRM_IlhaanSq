import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDatabaseError } from "@/utils/errorFormatter";
import { parseVariantAttributes } from "@/utils/variantAttributes";
import { useEffect } from "react";
import { backendAccessMode } from "@/lib/backendAccessPolicy";
import { appLogger } from "@/utils/logger";
import { useTenantMembership } from "@/hooks/useTenantMembership";
import {
  listProductsWithServerAccess,
  upsertProductWithServerAccess,
} from "@/modules/inventory/services/productsService";

export interface Product {
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
  product_variants?: Array<{
    id: string;
    product_id?: string;
    stock_quantity: number;
    cost: number | null;
    rate: number | null;
    low_stock_threshold?: number | null;
    image_url?: string | null;
    attributes?: Record<string, string>;
    sku?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
}

export interface CreateProductData {
  name: string;
  sku?: string;
  rate: number;
  minimum_sale_price?: number | null;
  cost?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  size?: string;
  color?: string;
  image_url?: string;
  has_variants?: boolean;
}

type ProductToastOptions = {
  message?: string;
  suppress?: boolean;
};

type CreateProductInput = CreateProductData | { data: CreateProductData; toast?: ProductToastOptions };

type TrashListItem = {
  id?: string | null;
};

function getCreateProductToastOptions(input: CreateProductInput): ProductToastOptions | undefined {
  return "data" in input ? input.toast : undefined;
}

const removeItemById = (prev: unknown, id: string) => {
  if (!Array.isArray(prev)) return prev;
  return (prev as TrashListItem[]).filter((item) => item?.id !== id);
};

export const useProducts = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserRole();
  const productsQueryKey = ["products", tenantId] as const;
  const productsRealtimeFilter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

  useEffect(() => {
    if (backendAccessMode === "api_first") {
      appLogger.warn(
        "Products module still has some direct Supabase operations while NEXT_PUBLIC_BACKEND_ACCESS_MODE=api_first.",
      );
    }
  }, []);

  const {
    data: products = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: productsQueryKey,
    queryFn: async () => {
      const data = await listProductsWithServerAccess();
      const parsed = (data as Product[]).map((product) => ({
        ...product,
        product_variants: (product.product_variants || []).map((variant) => ({
          ...variant,
          attributes: parseVariantAttributes(variant.attributes),
        })),
      }));
      return parsed;
    },
    enabled: !!user && !!tenantId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (!user || !enabled || !tenantId || !productsRealtimeFilter) return;
    const channel = supabase
      .channel(`products-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: productsRealtimeFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: productsQueryKey });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants", filter: productsRealtimeFilter },
        () => {
          queryClient.invalidateQueries({ queryKey: productsQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, productsQueryKey, productsRealtimeFilter, queryClient, tenantId, user]);

  const createProduct = useMutation({
    mutationFn: async (productInput: CreateProductInput) => {
      if (!hasPermission("products.add")) {
        throw new Error("You do not have permission to add products.");
      }
      const productData = "data" in productInput ? productInput.data : productInput;
      // Handle empty SKU by setting it to null
      const processedData = {
        ...productData,
        sku: productData.sku && productData.sku.trim() !== '' ? productData.sku : null,
      };
      return upsertProductWithServerAccess({ data: processedData });
    },
    onSuccess: (_data, variables) => {
      const toastOptions = getCreateProductToastOptions(variables);
      queryClient.invalidateQueries({
        queryKey: productsQueryKey,
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!toastOptions?.suppress) {
        toast.success(toastOptions?.message ?? "Product created successfully");
      }
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "create product"));
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({
      id,
      data,
      toast: _toast,
    }: {
      id: string;
      data: Partial<CreateProductData>;
      toast?: ProductToastOptions;
    }) => {
      if (!hasPermission("products.edit")) {
        throw new Error("You do not have permission to edit products.");
      }
      // Handle empty SKU by setting it to null
      const processedData = {
        ...data,
        sku: data.sku !== undefined ? (data.sku && data.sku.trim() !== '' ? data.sku : null) : undefined
      };
      return upsertProductWithServerAccess({ id, data: processedData });
    },
    onSuccess: (_data, variables) => {
      const toastOptions = variables?.toast;
      queryClient.invalidateQueries({
        queryKey: productsQueryKey,
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (!toastOptions?.suppress) {
        toast.success(toastOptions?.message ?? "Product updated successfully");
      }
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "update product"));
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("products.delete")) {
        throw new Error("You do not have permission to delete products.");
      }
      if (!tenantId) {
        throw new Error("No active tenant found.");
      }
      // Soft delete the product by marking it as deleted
      const { error } = await supabase
        .from("products")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["reusable-attributes"] }); // Refresh attribute usage
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('productDeleted'));
      toast.success("Product deleted successfully");
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "delete product"));
    },
  });

  const restoreProduct = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("products.delete")) {
        throw new Error("You do not have permission to restore products.");
      }
      if (!tenantId) {
        throw new Error("No active tenant found.");
      }
      // Restore the product by marking it as not deleted
      const { error } = await supabase
        .from("products")
        .update({
          is_deleted: false,
          deleted_at: null
        })
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trashed-products"], (prev: unknown) => removeItemById(prev, id));
      queryClient.setQueryData(["trash", "products"], (prev: unknown) => removeItemById(prev, id));
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["all_products", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["reusable-attributes"] }); // Refresh attribute usage
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('productRestored'));
      toast.success("Product restored successfully");
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "restore product"));
    },
  });

  const hardDeleteProduct = useMutation({
    mutationFn: async (id: string) => {
      if (!hasPermission("products.delete")) {
        throw new Error("You do not have permission to delete products.");
      }
      if (!tenantId) {
        throw new Error("No active tenant found.");
      }

      const { error } = await supabase.rpc("hard_delete_product", {
        _product_id: id,
      });
      if (error) {
        console.error("Error hard deleting product:", error);
        throw error;
      }
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["trashed-products"], (prev: unknown) => removeItemById(prev, id));
      queryClient.setQueryData(["trash", "products"], (prev: unknown) => removeItemById(prev, id));
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trashed-products"] });
      queryClient.invalidateQueries({ queryKey: ["trash", "products"] });
      queryClient.invalidateQueries({ queryKey: ["reusable-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      window.dispatchEvent(new CustomEvent('productDeleted'));
      toast.success("Product permanently deleted");
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "delete product"));
    },
  });

  const duplicateProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!hasPermission("products.duplicate")) {
        throw new Error("You do not have permission to duplicate products.");
      }
      if (!tenantId) {
        throw new Error("No active tenant found.");
      }
      // First, get the original product
      const { data: originalProduct, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .single();

      if (productError) throw productError;

      // Generate new name and SKU for the duplicated product
      const generateUniqueName = async (originalName: string): Promise<string> => {
        const baseName = originalName.replace(/\s*\(\d+\)$/, '');
        let counter = 1;
        let newName = `${baseName} (${counter})`;

        while (true) {
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("name", newName)
            .eq("tenant_id", tenantId)
            .eq("is_deleted", false)
            .single();

          if (!existing) break;
          counter++;
          newName = `${baseName} (${counter})`;
        }
        return newName;
      };

      const generateUniqueSku = async (originalSku: string | null): Promise<string | null> => {
        if (!originalSku) return null;
        const baseSku = originalSku.replace(/\s*\(\d+\)$/, '');
        let counter = 1;
        let newSku = `${baseSku} (${counter})`;

        while (true) {
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("sku", newSku)
            .eq("tenant_id", tenantId)
            .eq("is_deleted", false)
            .single();

          if (!existing) break;
          counter++;
          newSku = `${baseSku} (${counter})`;
        }
        return newSku;
      };

      const newName = await generateUniqueName(originalProduct.name);
      const newSku = await generateUniqueSku(originalProduct.sku);

      const { data: newProduct, error: createError } = await supabase
        .from("products")
        .insert([{
          name: newName,
          sku: newSku,
          rate: originalProduct.rate,
          cost: originalProduct.cost,
          stock_quantity: originalProduct.stock_quantity,
          low_stock_threshold: originalProduct.low_stock_threshold,
          size: originalProduct.size,
          color: originalProduct.color,
          image_url: originalProduct.image_url,
          has_variants: originalProduct.has_variants,
          created_by: user?.id,
          tenant_id: tenantId,
        }])
        .select()
        .single();

      if (createError) throw createError;

      if (originalProduct.has_variants) {
        const { data: originalVariants, error: variantsError } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product_id", productId)
          .eq("tenant_id", tenantId);

        if (variantsError) throw variantsError;

        if (originalVariants && originalVariants.length > 0) {
          const newVariants = originalVariants.map(variant => ({
            product_id: newProduct.id,
            attributes: variant.attributes,
            rate: variant.rate,
            cost: variant.cost,
            stock_quantity: variant.stock_quantity,
            low_stock_threshold: variant.low_stock_threshold,
            sku: variant.sku ? `${variant.sku}-copy` : null,
            image_url: variant.image_url,
            tenant_id: tenantId,
          }));

          const { error: createVariantsError } = await supabase
            .from("product_variants")
            .insert(newVariants);

          if (createVariantsError) throw createVariantsError;
        }
      }

      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["all_product_variants"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Product duplicated successfully with all variants");
    },
    onError: (error) => {
      toast.error(formatDatabaseError(error, "duplicate product"));
    },
  });

  return {
    products,
    isLoading,
    error,
    refetch,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    hardDeleteProduct,
    duplicateProduct,
  };
};

// Hook to get all products including deleted ones (for sales/invoices)
export const useAllProducts = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantMembership();

  const {
    data: allProducts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["all_products", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user && !!tenantId,
  });

  return {
    allProducts,
    isLoading,
    error,
  };
};
