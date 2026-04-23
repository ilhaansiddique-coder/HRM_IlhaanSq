
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { parseVariantAttributes } from "@/utils/variantAttributes";
import { useEffect } from "react";
import {
  bulkUpsertProductVariantsWithServerAccess,
  clearProductVariantsWithServerAccess,
  listProductVariantsWithServerAccess,
} from "@/modules/inventory/services/productsService";

export interface VariantAttributes {
  [key: string]: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  attributes: VariantAttributes;
  sku: string | null;
  rate: number | null;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttributeDefinition {
  name: string;
  values: string[];
}

type VariantToastOptions = {
  message?: string;
  suppress?: boolean;
};

export const useProductVariants = (productId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: variants = [], isLoading, refetch } = useQuery({
    queryKey: ["product_variants", productId],
    queryFn: async () => {
      if (!productId) return [] as ProductVariant[];
      const cachedProducts = queryClient.getQueryData<
        Array<{ id: string; product_variants?: ProductVariant[] }>
      >(["products"]);
      const cachedProduct = cachedProducts?.find((product) => product.id === productId);
      const data =
        cachedProduct?.product_variants && cachedProduct.product_variants.length > 0
          ? cachedProduct.product_variants
          : await listProductVariantsWithServerAccess(productId);
      const parsed = (data as ProductVariant[]).map((variant) => ({
        ...variant,
        attributes: parseVariantAttributes(variant.attributes),
      }));
      return parsed;
    },
    enabled: !!user && !!productId,
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user || !productId) return;
    const channel = supabase
      .channel(`product-variants-${productId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants", filter: `product_id=eq.${productId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["product_variants", productId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, productId, user]);

  const bulkUpsert = useMutation({
    mutationFn: async (params: {
      productId: string;
      hasVariants: boolean;
      attributes?: AttributeDefinition[];
      variants: Omit<ProductVariant, "id" | "created_at" | "updated_at">[];
      toast?: VariantToastOptions;
    }) => {
      const { toast: _toast, ...payload } = params;
      await bulkUpsertProductVariantsWithServerAccess({
        productId: payload.productId,
        hasVariants: payload.hasVariants,
        attributes: payload.attributes,
        variants: payload.variants,
      });
      return true;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch all product_variants queries (including specific product queries)
      queryClient.invalidateQueries({
        queryKey: ["product_variants"],
        refetchType: 'active' // Force refetch of active queries
      });
      queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({
        queryKey: ["all_product_variants"],
        refetchType: 'active'
      });
      // Also invalidate the specific product's variants query
      if (variables.productId) {
        queryClient.invalidateQueries({
          queryKey: ["product_variants", variables.productId],
          refetchType: 'active'
        });
      }
      const toastOptions = variables?.toast;
      if (!toastOptions?.suppress) {
        toast.success(toastOptions?.message ?? "Variants saved successfully");
      }
    },
    onError: (err: any) => {
      console.error("Bulk upsert error:", err);
      toast.error("Failed to save variants: " + err.message);
    },
  });

  const clearVariants = useMutation({
    mutationFn: async (productId: string) => {
      await clearProductVariantsWithServerAccess(productId);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product_variants"],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({
        queryKey: ["products"],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({
        queryKey: ["all_product_variants"],
        refetchType: 'active'
      });
      toast.success("Variants cleared");
    },
    onError: (err: any) => {
      toast.error("Failed to clear variants: " + err.message);
    },
  });

  return { variants, isLoading, refetch, bulkUpsert, clearVariants };
};

