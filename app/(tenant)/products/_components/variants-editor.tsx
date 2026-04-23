"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AttributeDef = { name: string; values: string[] };

export type VariantRow = {
  sku: string;
  rate: string;
  cost: string;
  stockQuantity: string;
  lowStockThreshold: string;
  imageUrl: string;
};

export type VariantsState = {
  attributes: AttributeDef[];
  rows: Record<string, VariantRow>;
};

type Props = {
  parentSkuPreview: string;
  parentRate: string;
  parentCost: string;
  parentLowStock: string;
  value: VariantsState;
  onChange: (next: VariantsState) => void;
};

export function sortedKey(a: Record<string, string>): string {
  const keys = Object.keys(a).sort();
  const ordered: Record<string, string> = {};
  for (const k of keys) ordered[k] = a[k];
  return JSON.stringify(ordered);
}

function emptyRow(): VariantRow {
  return {
    sku: "",
    rate: "",
    cost: "",
    stockQuantity: "",
    lowStockThreshold: "",
    imageUrl: "",
  };
}

export function computeCombos(
  attributes: AttributeDef[]
): Record<string, string>[] {
  if (!attributes.length) return [];
  const lists = attributes.map((a) =>
    a.values.filter(Boolean).map((v) => ({ [a.name]: v }))
  );
  if (lists.some((l) => l.length === 0)) return [];
  return lists.reduce<Record<string, string>[]>(
    (acc, list) => acc.flatMap((a) => list.map((b) => ({ ...a, ...b }))),
    [{}]
  );
}

export function VariantsEditor({
  parentSkuPreview,
  parentRate,
  parentCost,
  parentLowStock,
  value,
  onChange,
}: Props) {
  const { attributes, rows } = value;
  const [pendingValues, setPendingValues] = useState<string[]>(
    attributes.map(() => "")
  );
  const [bulk, setBulk] = useState({
    rate: "",
    cost: "",
    low: "",
    qty: "",
  });

  const combos = useMemo(() => computeCombos(attributes), [attributes]);

  function updateAttributes(next: AttributeDef[]) {
    onChange({ attributes: next, rows });
  }

  function addAttribute() {
    updateAttributes([...attributes, { name: "", values: [] }]);
    setPendingValues([...pendingValues, ""]);
  }

  function removeAttribute(idx: number) {
    const next = attributes.filter((_, i) => i !== idx);
    updateAttributes(next);
    setPendingValues(pendingValues.filter((_, i) => i !== idx));
  }

  function setAttributeName(idx: number, name: string) {
    const next = [...attributes];
    next[idx] = { ...next[idx], name };
    updateAttributes(next);
  }

  function setPendingValue(idx: number, v: string) {
    const next = [...pendingValues];
    next[idx] = v;
    setPendingValues(next);
  }

  function commitValues(idx: number) {
    const raw = (pendingValues[idx] ?? "").trim();
    if (!raw) return;
    const fresh = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const existing = new Set(
      attributes[idx].values.map((v) => v.toLowerCase())
    );
    const unique = fresh.filter((v) => !existing.has(v.toLowerCase()));
    if (unique.length) {
      const next = [...attributes];
      next[idx] = {
        ...next[idx],
        values: [...next[idx].values, ...unique],
      };
      updateAttributes(next);
    }
    setPendingValue(idx, "");
  }

  function removeValue(idx: number, valueIdx: number) {
    const next = [...attributes];
    next[idx] = {
      ...next[idx],
      values: next[idx].values.filter((_, i) => i !== valueIdx),
    };
    updateAttributes(next);
  }

  function setRow(key: string, patch: Partial<VariantRow>) {
    onChange({
      attributes,
      rows: { ...rows, [key]: { ...emptyRow(), ...rows[key], ...patch } },
    });
  }

  function applyBulk() {
    const next: Record<string, VariantRow> = {};
    for (const attrs of combos) {
      const key = sortedKey(attrs);
      const cur = rows[key] ?? emptyRow();
      next[key] = {
        ...cur,
        rate: bulk.rate !== "" ? bulk.rate : cur.rate,
        cost: bulk.cost !== "" ? bulk.cost : cur.cost,
        lowStockThreshold:
          bulk.low !== "" ? bulk.low : cur.lowStockThreshold,
        stockQuantity: bulk.qty !== "" ? bulk.qty : cur.stockQuantity,
      };
    }
    onChange({ attributes, rows: next });
    setBulk({ rate: "", cost: "", low: "", qty: "" });
  }

  const totalStock = combos.reduce((sum, attrs) => {
    const v = rows[sortedKey(attrs)];
    const n = v?.stockQuantity ? parseInt(v.stockQuantity, 10) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
          <div className="text-sm font-medium">Attributes</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addAttribute}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {attributes.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Add an attribute (e.g., Size, Color) to generate variants.
          </div>
        ) : (
          <div className="divide-y">
            {attributes.map((attr, idx) => (
              <div key={idx} className="space-y-2 p-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Attribute name</Label>
                    <Input
                      value={attr.name}
                      onChange={(e) => setAttributeName(idx, e.target.value)}
                      placeholder="e.g., Size"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-5 text-destructive"
                    onClick={() => removeAttribute(idx)}
                    aria-label="Remove attribute"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Values</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pendingValues[idx] ?? ""}
                      onChange={(e) => setPendingValue(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitValues(idx);
                        }
                      }}
                      placeholder="Type value and press Enter (or comma-separated)"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => commitValues(idx)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {attr.values.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {attr.values.map((v, vi) => (
                        <Badge
                          key={vi}
                          variant="secondary"
                          className="gap-1 pl-2 pr-1"
                        >
                          {v}
                          <button
                            type="button"
                            onClick={() => removeValue(idx, vi)}
                            className="rounded hover:bg-secondary/60"
                            aria-label={`Remove ${v}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {combos.length > 0 && (
        <>
          <section className="rounded-lg border">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <div className="text-sm font-medium">Bulk fill</div>
              <span className="text-xs text-muted-foreground">
                Applies the values below to every variant row.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
              <Input
                type="number"
                step="0.01"
                placeholder="Price"
                value={bulk.rate}
                onChange={(e) => setBulk({ ...bulk, rate: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Cost"
                value={bulk.cost}
                onChange={(e) => setBulk({ ...bulk, cost: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder="Low stock"
                value={bulk.low}
                onChange={(e) => setBulk({ ...bulk, low: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder="Quantity"
                value={bulk.qty}
                onChange={(e) => setBulk({ ...bulk, qty: e.target.value })}
              />
              <Button type="button" onClick={applyBulk}>
                Apply to all
              </Button>
            </div>
          </section>

          <section className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <div className="text-sm font-medium">
                Variants ({combos.length})
              </div>
              <div className="text-xs text-muted-foreground">
                Total stock: <span className="font-semibold">{totalStock}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Low Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combos.map((attrs, i) => {
                    const key = sortedKey(attrs);
                    const row = rows[key] ?? emptyRow();
                    const skuPlaceholder = parentSkuPreview
                      ? `${parentSkuPreview}-${i + 1}`
                      : `Variant-${i + 1}`;
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(attrs).map(([k, v]) => (
                              <Badge key={k} variant="secondary">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.sku}
                            onChange={(e) =>
                              setRow(key, { sku: e.target.value })
                            }
                            placeholder={skuPlaceholder}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) =>
                              setRow(key, { rate: e.target.value })
                            }
                            placeholder={parentRate || "0"}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.cost}
                            onChange={(e) =>
                              setRow(key, { cost: e.target.value })
                            }
                            placeholder={parentCost || "0"}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={row.stockQuantity}
                            onChange={(e) =>
                              setRow(key, { stockQuantity: e.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={row.lowStockThreshold}
                            onChange={(e) =>
                              setRow(key, {
                                lowStockThreshold: e.target.value,
                              })
                            }
                            placeholder={parentLowStock}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
