"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Layers, Loader2, Package, RefreshCcw } from "lucide-react";
import {
  createProductAction,
  updateProductAction,
} from "../actions";
import {
  clearProductVariantsAction,
  upsertProductVariantsAction,
} from "../variants-actions";
import { ImageDropzone } from "./image-dropzone";
import { CategoryCombobox, type CategoryValue } from "./category-combobox";
import {
  VariantsEditor,
  computeCombos,
  sortedKey,
  type AttributeDef,
  type VariantRow,
  type VariantsState,
} from "./variants-editor";
import { ActivityTab } from "./activity-tab";
import {
  SKU_COLORS,
  SKU_SIZES,
  buildSku,
  parseStyleFromSku,
} from "@/lib/sku";
import type {
  SerializedAttribute,
  SerializedVariant,
} from "./product-list";

type ProductInitial = {
  id: string;
  name: string;
  sku: string | null;
  rate: number | string;
  cost: number | string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  size?: string | null;
  color?: string | null;
  hasVariants?: boolean;
  variants?: SerializedVariant[];
  attributeDefs?: SerializedAttribute[];
};

function inferCategoryCodeFromSku(sku: string | null | undefined): string {
  if (!sku) return "";
  return sku.split("-")[0] ?? "";
}

function buildInitialVariantsState(
  initial: ProductInitial | undefined
): VariantsState {
  if (!initial?.hasVariants) return { attributes: [], rows: {} };

  const attributes: AttributeDef[] = (initial.attributeDefs ?? []).map((a) => ({
    name: a.name,
    values: a.values,
  }));

  const rows: Record<string, VariantRow> = {};
  for (const v of initial.variants ?? []) {
    const key = sortedKey(v.attributes);
    rows[key] = {
      sku: v.sku ?? "",
      rate: v.rate !== null ? String(v.rate) : "",
      cost: v.cost !== null ? String(v.cost) : "",
      stockQuantity: String(v.stockQuantity),
      lowStockThreshold:
        v.lowStockThreshold !== null ? String(v.lowStockThreshold) : "",
      imageUrl: v.imageUrl ?? "",
    };
  }
  return { attributes, rows };
}

export function ProductDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const [name, setName] = useState<string>(initial?.name ?? "");
  const [category, setCategory] = useState<CategoryValue | null>(() => {
    if (!isEdit) return null;
    const code = inferCategoryCodeFromSku(initial?.sku);
    return code ? { code, label: code, isNew: false } : null;
  });
  const [color, setColor] = useState<string>(initial?.color ?? "");
  const [size, setSize] = useState<string>(initial?.size ?? "");
  const [rate, setRate] = useState<string>(
    initial ? String(Number(initial.rate)) : ""
  );
  const [cost, setCost] = useState<string>(
    initial?.cost ? String(Number(initial.cost)) : ""
  );
  const [stockQuantity, setStockQuantity] = useState<string>(
    String(initial?.stockQuantity ?? 0)
  );
  const [lowStock, setLowStock] = useState<string>(
    String(initial?.lowStockThreshold ?? 10)
  );
  const [imageUrl, setImageUrl] = useState<string>(initial?.imageUrl ?? "");
  const [styleNumber, setStyleNumber] = useState<number>(() => {
    if (!isEdit) return 1;
    const code = inferCategoryCodeFromSku(initial?.sku);
    return parseStyleFromSku(initial?.sku ?? null, code) ?? 1;
  });
  const [fetchingStyle, setFetchingStyle] = useState(false);
  const [hasVariants, setHasVariants] = useState<boolean>(
    initial?.hasVariants ?? false
  );
  const [variantsState, setVariantsState] = useState<VariantsState>(() =>
    buildInitialVariantsState(initial)
  );
  const [activeTab, setActiveTab] = useState<string>("details");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    if (isEdit) {
      const code = inferCategoryCodeFromSku(initial?.sku);
      setCategory(code ? { code, label: code, isNew: false } : null);
      setStyleNumber(parseStyleFromSku(initial?.sku ?? null, code) ?? 1);
    } else {
      setCategory(null);
      setStyleNumber(1);
    }
    setColor(initial?.color ?? "");
    setSize(initial?.size ?? "");
    setRate(initial ? String(Number(initial.rate)) : "");
    setCost(initial?.cost ? String(Number(initial.cost)) : "");
    setStockQuantity(String(initial?.stockQuantity ?? 0));
    setLowStock(String(initial?.lowStockThreshold ?? 10));
    setImageUrl(initial?.imageUrl ?? "");
    setHasVariants(initial?.hasVariants ?? false);
    setVariantsState(buildInitialVariantsState(initial));
    setActiveTab("details");
    setError(null);
  }, [open, initial, isEdit]);

  useEffect(() => {
    if (isEdit || !category?.code) return;
    let cancelled = false;
    setFetchingStyle(true);
    fetch(
      `/api/products/next-style-number?category=${encodeURIComponent(category.code)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.styleNumber === "number")
          setStyleNumber(data.styleNumber);
      })
      .catch(() => {})
      .finally(() => !cancelled && setFetchingStyle(false));
    return () => {
      cancelled = true;
    };
  }, [category?.code, isEdit]);

  const sku = category?.code
    ? buildSku({ category: category.code, style: styleNumber, color, size })
    : "";

  const combos = useMemo(
    () => computeCombos(variantsState.attributes),
    [variantsState.attributes]
  );

  const totalVariantStock = useMemo(
    () =>
      combos.reduce((sum, attrs) => {
        const row = variantsState.rows[sortedKey(attrs)];
        const n = row?.stockQuantity ? parseInt(row.stockQuantity, 10) : 0;
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [combos, variantsState.rows]
  );

  async function refreshStyleNumber() {
    if (!category?.code) return;
    setFetchingStyle(true);
    try {
      const res = await fetch(
        `/api/products/next-style-number?category=${encodeURIComponent(category.code)}`
      );
      const data = await res.json();
      if (typeof data?.styleNumber === "number")
        setStyleNumber(data.styleNumber);
    } finally {
      setFetchingStyle(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("name", name);
    fd.set("sku", sku);
    fd.set("rate", rate);
    fd.set("cost", cost);
    fd.set(
      "stockQuantity",
      hasVariants ? String(totalVariantStock) : stockQuantity
    );
    fd.set("imageUrl", imageUrl);
    fd.set("color", hasVariants ? "" : color);
    fd.set("size", hasVariants ? "" : size);
    fd.set("categoryLabel", category?.label ?? "");
    fd.set("categoryCode", category?.code ?? "");
    fd.set("categoryIsNew", category?.isNew ? "1" : "0");
    if (isEdit) fd.set("productId", initial!.id);

    startTransition(async () => {
      try {
        const saved = isEdit
          ? await updateProductAction(fd)
          : await createProductAction(fd);

        const productId = saved?.id ?? initial?.id;
        if (!productId) throw new Error("Could not resolve product id");

        if (hasVariants) {
          const variants = combos.map((attrs) => {
            const row = variantsState.rows[sortedKey(attrs)] ?? {
              sku: "",
              rate: "",
              cost: "",
              stockQuantity: "",
              lowStockThreshold: "",
              imageUrl: "",
            };
            return {
              attributes: attrs,
              sku: row.sku || null,
              rate: row.rate ? parseFloat(row.rate) : null,
              cost: row.cost ? parseFloat(row.cost) : null,
              stockQuantity: row.stockQuantity
                ? parseInt(row.stockQuantity, 10)
                : 0,
              lowStockThreshold: row.lowStockThreshold
                ? parseInt(row.lowStockThreshold, 10)
                : null,
              imageUrl: row.imageUrl || null,
            };
          });
          await upsertProductVariantsAction({
            productId,
            hasVariants: true,
            attributes: variantsState.attributes,
            variants,
          });
        } else if (isEdit && initial?.hasVariants) {
          await clearProductVariantsAction(productId);
        }

        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh]">
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogHeader className="shrink-0 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-base">
                    {isEdit ? "Edit product" : "Add product"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {isEdit
                      ? "Update details and variant stock"
                      : "Enter details, optionally enable variants"}
                  </DialogDescription>
                </div>
              </div>
              <TabsList
                className={`mt-3 grid w-full ${isEdit ? "grid-cols-3" : "grid-cols-2"}`}
              >
                <TabsTrigger value="details">
                  <Package className="mr-1 hidden h-3.5 w-3.5 sm:block" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="variants">
                  <Layers className="mr-1 hidden h-3.5 w-3.5 sm:block" />
                  Variants
                  {combos.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">
                      {combos.length}
                    </span>
                  )}
                </TabsTrigger>
                {isEdit && (
                  <TabsTrigger value="activity">
                    <History className="mr-1 hidden h-3.5 w-3.5 sm:block" />
                    Activity
                  </TabsTrigger>
                )}
              </TabsList>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {error && (
                <div className="mb-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Cotton T-Shirt"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category *</Label>
                    <CategoryCombobox
                      value={category}
                      onChange={setCategory}
                      disabled={isEdit}
                    />
                    {category?.isNew && (
                      <p className="text-xs text-muted-foreground">
                        Will be created as{" "}
                        <span className="font-mono">{category.code}</span> on
                        save.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sku-display">SKU (auto)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sku-display"
                        value={sku || "—"}
                        readOnly
                        className="bg-muted/50 font-mono text-sm"
                        tabIndex={-1}
                      />
                      {!isEdit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={refreshStyleNumber}
                          disabled={!category?.code || fetchingStyle}
                          title="Refresh style number"
                        >
                          {fetchingStyle ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="color">Color</Label>
                    <Select
                      value={color}
                      onValueChange={setColor}
                      disabled={hasVariants}
                    >
                      <SelectTrigger id="color">
                        <SelectValue
                          placeholder={
                            hasVariants
                              ? "Set per variant"
                              : "Select color"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {SKU_COLORS.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="size">Size</Label>
                    <Select
                      value={size}
                      onValueChange={setSize}
                      disabled={hasVariants}
                    >
                      <SelectTrigger id="size">
                        <SelectValue
                          placeholder={
                            hasVariants ? "Set per variant" : "Select size"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {SKU_SIZES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rate">Sale Price *</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cost">Cost Price</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stockQuantity">Stock Quantity</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min="0"
                      value={hasVariants ? totalVariantStock : stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      disabled={hasVariants}
                    />
                    {hasVariants && (
                      <p className="text-xs text-muted-foreground">
                        Auto-calculated from variants.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lowStock">Low Stock Alert</Label>
                    <Input
                      id="lowStock"
                      type="number"
                      min="0"
                      value={lowStock}
                      onChange={(e) => setLowStock(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Product Image</Label>
                    <ImageDropzone
                      name="imageUrl"
                      defaultValue={imageUrl}
                      disabled={pending}
                      onChangeUrl={setImageUrl}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="variants" className="mt-0 space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                  <div>
                    <Label htmlFor="has-variants" className="text-sm">
                      Enable variations
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Track size / color / etc. separately.
                    </p>
                  </div>
                  <Switch
                    id="has-variants"
                    checked={hasVariants}
                    onCheckedChange={setHasVariants}
                  />
                </div>

                {hasVariants ? (
                  <VariantsEditor
                    parentSkuPreview={sku}
                    parentRate={rate}
                    parentCost={cost}
                    parentLowStock={lowStock}
                    value={variantsState}
                    onChange={setVariantsState}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    Variations are off. Toggle to add sizes, colors, etc.
                  </div>
                )}
              </TabsContent>

              {isEdit && initial?.id && (
                <TabsContent value="activity" className="mt-0">
                  <ActivityTab
                    productId={initial.id}
                    active={activeTab === "activity"}
                  />
                </TabsContent>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background/95 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !category?.code}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Create product"}
              </Button>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
