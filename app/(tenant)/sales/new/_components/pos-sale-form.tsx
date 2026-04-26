"use client";

import { useState, useMemo, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Loader2,
  X,
} from "lucide-react";
import { useCurrency } from "../../../_components/providers";
import { createSaleAction, updateSaleAction } from "../../actions";

type Variant = {
  id: string;
  label: string;
  sku: string | null;
  rate: number;
  stockQuantity: number;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  rate: number;
  stockQuantity: number;
  variants?: Variant[];
};

type PaymentMethodMeta = {
  id: string;
  name: string;
  key: string;
  type: string;
  defaultTerms: PaymentTerms;
  defaultPaidBehavior: "full" | "zero" | "custom";
  sortOrder: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  whatsapp: string | null;
};

type CartItem = {
  productId: string;
  // null for products with no variant axis. The same productId can
  // appear multiple times in the cart with different variantIds —
  // that's the whole point of variants.
  variantId?: string | null;
  productName: string;
  variantLabel?: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

type PaymentTerms = "immediate" | "cod" | "credit";

type PaymentSplit = {
  method: string;
  amount: number;
};

// Initial seed for edit mode. Same shape as DraftShape minus draft-only
// concerns; carries the saleId + saleDate + invoice number.
export type POSSaleFormInitial = {
  saleId: string;
  saleDate?: string;
  cart: CartItem[];
  customerMode: "new" | "existing";
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerWhatsapp: string;
  discountAmount: number;
  charge: number;
  paymentMethod: string;
  paymentTerms: PaymentTerms;
  creditDays: number;
  paymentSplits: PaymentSplit[];
  notes: string;
};

const DRAFT_KEY = "sales:new-sale:draft:v1";

type DraftShape = {
  cart: CartItem[];
  customerMode: "new" | "existing";
  selectedCustomerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerWhatsapp: string;
  discountAmount: number;
  charge: number;
  paymentMethod: string;
  paymentTerms: PaymentTerms;
  creditDays: number;
  paymentSplits: PaymentSplit[];
  notes: string;
};

export function POSSaleForm({
  products,
  customers,
  paymentMethods,
  onSuccess,
  mode = "create",
  initial,
}: {
  products: Product[];
  customers: Customer[];
  paymentMethods: PaymentMethodMeta[];
  // When provided (dialog usage), the form notifies its parent on
  // successful submit instead of navigating to /sales itself. Always
  // calls router.refresh() so the listing reflects the new sale.
  onSuccess?: () => void;
  // "create" wires the form to createSaleAction + draft persistence.
  // "edit" wires it to updateSaleAction (the saleId comes from
  // `initial.saleId`) and disables draft persistence so an
  // in-progress edit doesn't leak into a fresh New Sale.
  mode?: "create" | "edit";
  initial?: POSSaleFormInitial;
}) {
  const router = useRouter();
  const { formatAmount, symbol } = useCurrency();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  // Cart
  const [cart, setCart] = useState<CartItem[]>(initial?.cart ?? []);
  const [search, setSearch] = useState("");
  // When the user clicks a product that has variants, we open this
  // little picker dialog instead of adding the parent product.
  const [variantPickerProduct, setVariantPickerProduct] =
    useState<Product | null>(null);

  // Customer
  const [customerMode, setCustomerMode] = useState<"new" | "existing">(
    initial?.customerMode ?? "new"
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initial?.selectedCustomerId ?? ""
  );
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [customerAddress, setCustomerAddress] = useState(initial?.customerAddress ?? "");
  const [customerWhatsapp, setCustomerWhatsapp] = useState(initial?.customerWhatsapp ?? "");

  // Totals + payment
  const [discountAmount, setDiscountAmount] = useState(initial?.discountAmount ?? 0);
  const [charge, setCharge] = useState(initial?.charge ?? 0);
  const [paymentMethod, setPaymentMethod] = useState(
    initial?.paymentMethod ?? paymentMethods[0]?.name ?? "Cash"
  );
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(
    initial?.paymentTerms ?? "immediate"
  );
  const [creditDays, setCreditDays] = useState<number>(initial?.creditDays ?? 7);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>(
    initial?.paymentSplits ?? []
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Draft restore + persist — only in create mode. Edit mode skips
  // both because (a) we don't want a half-finished edit to bleed
  // into a fresh New Sale, and (b) the initial state IS the source
  // of truth for an edit.
  const draftRestored = useRef(false);
  useEffect(() => {
    if (isEdit) return;
    if (draftRestored.current) return;
    draftRestored.current = true;
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (!stored) return;
      const d = JSON.parse(stored) as Partial<DraftShape>;
      if (Array.isArray(d.cart)) setCart(d.cart);
      if (d.customerMode === "new" || d.customerMode === "existing") setCustomerMode(d.customerMode);
      if (typeof d.selectedCustomerId === "string") setSelectedCustomerId(d.selectedCustomerId);
      if (typeof d.customerName === "string") setCustomerName(d.customerName);
      if (typeof d.customerPhone === "string") setCustomerPhone(d.customerPhone);
      if (typeof d.customerAddress === "string") setCustomerAddress(d.customerAddress);
      if (typeof d.customerWhatsapp === "string") setCustomerWhatsapp(d.customerWhatsapp);
      if (typeof d.discountAmount === "number") setDiscountAmount(d.discountAmount);
      if (typeof d.charge === "number") setCharge(d.charge);
      if (typeof d.paymentMethod === "string") setPaymentMethod(d.paymentMethod);
      if (d.paymentTerms === "immediate" || d.paymentTerms === "cod" || d.paymentTerms === "credit") {
        setPaymentTerms(d.paymentTerms);
      }
      if (typeof d.creditDays === "number") setCreditDays(d.creditDays);
      if (Array.isArray(d.paymentSplits)) setPaymentSplits(d.paymentSplits);
      if (typeof d.notes === "string") setNotes(d.notes);
    } catch {
      // Corrupt draft — wipe it and continue.
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(() => {
      const draft: DraftShape = {
        cart,
        customerMode,
        selectedCustomerId,
        customerName,
        customerPhone,
        customerAddress,
        customerWhatsapp,
        discountAmount,
        charge,
        paymentMethod,
        paymentTerms,
        creditDays,
        paymentSplits,
        notes,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Quota or private mode — silently skip.
      }
    }, 250);
    return () => clearTimeout(t);
  }, [
    isEdit,
    cart,
    customerMode,
    selectedCustomerId,
    customerName,
    customerPhone,
    customerAddress,
    customerWhatsapp,
    discountAmount,
    charge,
    paymentMethod,
    paymentTerms,
    creditDays,
    paymentSplits,
    notes,
  ]);

  // Auto-prefill payment terms from the chosen method's metadata.
  // When the cashier picks "COD", default the term to "cod" and zero
  // the amountPaid; when they pick "Bkash", default to "immediate"
  // and full prepay. The cashier can still override the term picker
  // afterwards. Only fires on actual method change so we don't
  // overwrite the cashier's mid-flow term tweaks.
  const lastAppliedMethodRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastAppliedMethodRef.current === paymentMethod) return;
    lastAppliedMethodRef.current = paymentMethod;
    const meta = paymentMethods.find((m) => m.name === paymentMethod);
    if (!meta) return;
    setPaymentTerms(meta.defaultTerms);
    if (meta.defaultPaidBehavior === "zero") {
      // Drop any user-entered splits — the COD/credit defaults expect
      // the buyer hasn't paid anything up front.
      setPaymentSplits([]);
    }
  }, [paymentMethod, paymentMethods]);

  // Fuse.js fuzzy search — handles typos and partial matches that the
  // old `.includes()` filter missed (e.g. "kuta" finds "Cotton Kurta").
  // Threshold 0.3 is a sweet spot for product names; ignoreLocation
  // means a match anywhere in the string scores the same.
  const fuse = useMemo(
    () =>
      new Fuse(products, {
        keys: ["name", "sku"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim();
    if (!q) return products.slice(0, 50);
    return fuse.search(q).slice(0, 50).map((r) => r.item);
  }, [fuse, products, search]);

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discountAmount + charge);

  const splitsTotal = paymentSplits.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0
  );

  // amountPaid: splits drive it when present; otherwise the term default
  // applies (immediate = full, cod/credit = 0). Capped to grandTotal.
  const amountPaid = (() => {
    if (splitsTotal > 0) return Math.min(splitsTotal, grandTotal);
    return paymentTerms === "immediate" ? grandTotal : 0;
  })();
  const amountDue = Math.max(0, grandTotal - amountPaid);
  const derivedStatus =
    amountDue === 0 ? "paid" : amountPaid > 0 ? "partial" : "pending";

  const dueDate = useMemo(() => {
    if (paymentTerms !== "credit" || creditDays <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + creditDays);
    return d;
  }, [paymentTerms, creditDays]);

  // Cart row identity is (productId + variantId). The same product
  // can sit in the cart twice with different variants — that's
  // intentional. cartKey() centralizes the equality so updateQty /
  // setUnitPrice / removeFromCart all agree.
  const cartKey = (productId: string, variantId?: string | null) =>
    `${productId}::${variantId ?? ""}`;

  function addProductOrVariant(p: Product) {
    // Product has variants → defer to the picker. Otherwise add the
    // parent product directly (the legacy zero-variant path).
    if (p.variants && p.variants.length > 0) {
      setVariantPickerProduct(p);
      return;
    }
    addCartLine({
      productId: p.id,
      variantId: null,
      productName: p.name,
      variantLabel: null,
      unitPrice: p.rate,
      quantity: 1,
      maxStock: p.stockQuantity,
    });
  }

  function addVariantFromPicker(p: Product, v: Variant) {
    addCartLine({
      productId: p.id,
      variantId: v.id,
      productName: p.name,
      variantLabel: v.label || v.sku || "Variant",
      unitPrice: v.rate,
      quantity: 1,
      maxStock: v.stockQuantity,
    });
    setVariantPickerProduct(null);
  }

  function addCartLine(line: CartItem) {
    setCart((prev) => {
      const existing = prev.find(
        (c) => cartKey(c.productId, c.variantId) === cartKey(line.productId, line.variantId)
      );
      if (existing) {
        if (existing.quantity >= line.maxStock) return prev;
        return prev.map((c) =>
          cartKey(c.productId, c.variantId) === cartKey(line.productId, line.variantId)
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, line];
    });
  }

  function updateQty(
    productId: string,
    variantId: string | null | undefined,
    delta: number
  ) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (cartKey(c.productId, c.variantId) !== cartKey(productId, variantId)) return c;
          const next = c.quantity + delta;
          if (next < 1) return null;
          if (next > c.maxStock) return c;
          return { ...c, quantity: next };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function setUnitPrice(
    productId: string,
    variantId: string | null | undefined,
    value: number
  ) {
    setCart((prev) =>
      prev.map((c) =>
        cartKey(c.productId, c.variantId) === cartKey(productId, variantId)
          ? { ...c, unitPrice: value }
          : c
      )
    );
  }

  function removeFromCart(productId: string, variantId: string | null | undefined) {
    setCart((prev) =>
      prev.filter(
        (c) => cartKey(c.productId, c.variantId) !== cartKey(productId, variantId)
      )
    );
  }

  function selectExistingCustomer(id: string) {
    setSelectedCustomerId(id);
    const c = customers.find((c) => c.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? "");
      setCustomerAddress(c.address ?? "");
      setCustomerWhatsapp(c.whatsapp ?? "");
    }
  }

  // Customer auto-fill on typed name (mirrors the auto-create-or-match
  // server-side behavior so the cashier sees a hint when an existing
  // customer is recognized). Phone match wins over name match.
  const customerSuggestions = useMemo(() => {
    if (customerMode !== "new") return [];
    const nameQ = customerName.trim().toLowerCase();
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (!nameQ && !phoneDigits) return [];
    const matches: Customer[] = [];
    for (const c of customers) {
      const cPhoneDigits = (c.phone ?? "").replace(/\D/g, "");
      const phoneHit =
        phoneDigits && cPhoneDigits && cPhoneDigits === phoneDigits;
      const nameHit = nameQ && c.name.toLowerCase().includes(nameQ);
      if (phoneHit || nameHit) matches.push(c);
      if (matches.length >= 5) break;
    }
    return matches;
  }, [customers, customerMode, customerName, customerPhone]);

  function applySuggestion(c: Customer) {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? "");
    setCustomerAddress(c.address ?? "");
    setCustomerWhatsapp(c.whatsapp ?? "");
  }

  function addSplit() {
    setPaymentSplits((prev) => [
      ...prev,
      { method: paymentMethod, amount: amountDue > 0 ? amountDue : 0 },
    ]);
  }

  function updateSplit(idx: number, patch: Partial<PaymentSplit>) {
    setPaymentSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function removeSplit(idx: number) {
    setPaymentSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one product to the cart");
      return;
    }
    if (!customerName.trim()) {
      setError("Customer name is required");
      return;
    }
    if (!paymentMethod) {
      setError("Select a payment method");
      return;
    }
    if (paymentTerms === "credit" && (!creditDays || creditDays <= 0)) {
      setError("Credit term needs a valid days count");
      return;
    }
    // Reject splits that exceed the grand total — server caps too, but
    // local feedback is faster and surfaces the issue before submit.
    if (splitsTotal > grandTotal + 0.001) {
      setError("Split payments exceed the grand total");
      return;
    }

    const fd = new FormData();
    fd.set("customerName", customerName.trim());
    if (customerPhone) fd.set("customerPhone", customerPhone);
    if (customerAddress) fd.set("customerAddress", customerAddress);
    if (customerWhatsapp) fd.set("customerWhatsapp", customerWhatsapp);
    if (customerMode === "existing" && selectedCustomerId) {
      fd.set("customerId", selectedCustomerId);
    }
    fd.set("paymentMethod", paymentMethod);
    fd.set("paymentTerms", paymentTerms);
    if (paymentTerms === "credit") fd.set("creditDays", String(creditDays));
    if (paymentSplits.length > 0) {
      fd.set(
        "paymentSplitsJson",
        JSON.stringify(
          paymentSplits.map((s) => ({
            method: s.method,
            amount: Number(s.amount) || 0,
          }))
        )
      );
    }
    fd.set("discountAmount", String(discountAmount));
    fd.set("charge", String(charge));
    if (notes) fd.set("additionalInfo", notes);
    fd.set(
      "itemsJson",
      JSON.stringify(
        cart.map((c) => ({
          productId: c.productId,
          variantId: c.variantId ?? undefined,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))
      )
    );

    if (isEdit) {
      if (!initial?.saleId) {
        setError("Missing saleId for edit");
        return;
      }
      fd.set("saleId", initial.saleId);
      // Edit allows back-dating too — keep the original saleDate by
      // default unless the cashier wants to change it.
      if (initial.saleDate) fd.set("saleDate", initial.saleDate);
      // In edit mode customerId is whatever the original sale had
      // (or whatever the cashier picked from the existing-customer
      // dropdown). Don't auto-create here — the underlying service
      // doesn't run findOrCreate, it just trusts what the form sends.
      if (selectedCustomerId) fd.set("customerId", selectedCustomerId);
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateSaleAction(fd);
        } else {
          await createSaleAction(fd);
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            // ignore
          }
        }
        router.refresh();
        if (onSuccess) {
          onSuccess();
        } else if (!isEdit) {
          router.push("/sales");
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : isEdit
              ? "Failed to update sale"
              : "Failed to create sale"
        );
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* LEFT: Product picker + cart */}
      <div className="space-y-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />Add Products
            </CardTitle>
            <CardDescription>Search and tap to add to cart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div
              className="grid gap-2 sm:grid-cols-2 max-h-[280px] overflow-y-auto pr-1"
              data-lenis-prevent
            >
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 col-span-2">No products found</p>
              ) : (
                filteredProducts.map((p) => {
                  const hasVariants = (p.variants?.length ?? 0) > 0;
                  // For variant-bearing products, show the parent's
                  // total stock (sum of variants) so the cashier
                  // doesn't see "0 left" on a product whose variants
                  // are still in stock.
                  const displayStock = hasVariants
                    ? p.variants!.reduce((s, v) => s + v.stockQuantity, 0)
                    : p.stockQuantity;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProductOrVariant(p)}
                      disabled={displayStock <= 0}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5 text-left hover:border-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.name}
                          {hasVariants && (
                            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                              · {p.variants!.length} variants
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{p.sku ?? "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatAmount(p.rate)}</p>
                        <Badge variant={displayStock > 0 ? "outline" : "destructive"} className="text-[10px]">
                          {displayStock > 0 ? `${displayStock} left` : "Out"}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No items yet — pick products above</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {cart.map((c) => (
                  <div
                    key={cartKey(c.productId, c.variantId)}
                    className="flex items-center gap-2 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.productName}
                        {c.variantLabel && (
                          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                            · {c.variantLabel}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>{symbol}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={c.unitPrice}
                          onChange={(e) =>
                            setUnitPrice(c.productId, c.variantId, parseFloat(e.target.value) || 0)
                          }
                          className="h-6 w-20 text-xs px-2 py-0"
                        />
                        <span>· max {c.maxStock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQty(c.productId, c.variantId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-8 text-center">{c.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQty(c.productId, c.variantId, 1)}
                        disabled={c.quantity >= c.maxStock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right text-sm font-bold w-20">
                      {formatAmount(c.unitPrice * c.quantity)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(c.productId, c.variantId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Customer + totals + checkout */}
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`text-xs py-1.5 rounded ${customerMode === "new" ? "bg-background shadow-sm" : ""}`}
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`text-xs py-1.5 rounded ${customerMode === "existing" ? "bg-background shadow-sm" : ""}`}
              >
                Existing
              </button>
            </div>
            {customerMode === "existing" && (
              <Select value={selectedCustomerId} onValueChange={selectExistingCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.length === 0 ? (
                    <SelectItem value="_none" disabled>No customers</SelectItem>
                  ) : (
                    customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone && `(${c.phone})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                required
              />
              {customerMode === "new" && customerSuggestions.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-card text-sm">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    Existing customers — click to use
                  </div>
                  <div className="divide-y divide-border/40">
                    {customerSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applySuggestion(c)}
                        className="w-full px-2 py-1.5 text-left hover:bg-muted/50"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  type="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  type="tel"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Subtotal" value={formatAmount(subtotal)} />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Discount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="h-7 w-24 text-right text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Shipping / Charge</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={charge}
                onChange={(e) => setCharge(parseFloat(e.target.value) || 0)}
                className="h-7 w-24 text-right text-sm"
              />
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2">
              <span className="font-bold">Grand Total</span>
              <span className="text-xl font-bold text-primary">
                {formatAmount(grandTotal)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
            <CardDescription>
              Pick the term and how it's collected. Splits override the
              default amount paid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Default Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.length === 0 ? (
                    <SelectItem value="Cash">Cash</SelectItem>
                  ) : (
                    paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Terms</Label>
              <Select
                value={paymentTerms}
                onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate (paid now)</SelectItem>
                  <SelectItem value="cod">COD (collect on delivery)</SelectItem>
                  <SelectItem value="credit">Credit (pay later)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentTerms === "credit" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Days</Label>
                  <Input
                    type="number"
                    min="1"
                    value={creditDays}
                    onChange={(e) => setCreditDays(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <div className="h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                    {dueDate ? dueDate.toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Split payments. Empty list means the term default applies. */}
            <div className="space-y-1.5 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Split Payments</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={addSplit}
                >
                  <Plus className="h-3 w-3" />
                  Add Split
                </Button>
              </div>
              {paymentSplits.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No splits — uses term default ({paymentTerms === "immediate" ? "fully paid" : "fully due"}).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {paymentSplits.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Select
                        value={s.method}
                        onValueChange={(v) => updateSplit(i, { method: v })}
                      >
                        <SelectTrigger className="h-8 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.length === 0 ? (
                            <SelectItem value="Cash">Cash</SelectItem>
                          ) : (
                            paymentMethods.map((m) => (
                              <SelectItem key={m.id} value={m.name}>
                                {m.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={s.amount}
                        onChange={(e) =>
                          updateSplit(i, { amount: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 w-24 text-right text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeSplit(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1 border-t border-border/60 pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium text-emerald-600">
                  {formatAmount(amountPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount Due</span>
                <span
                  className={`font-medium ${amountDue > 0 ? "text-amber-600" : "text-foreground"}`}
                >
                  {formatAmount(amountDue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={
                    derivedStatus === "paid"
                      ? "default"
                      : derivedStatus === "partial"
                        ? "secondary"
                        : "outline"
                  }
                  className="rounded-lg"
                >
                  {derivedStatus}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for this sale..."
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={pending || cart.length === 0}
          className="w-full h-12 text-base font-bold"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Create Sale"} · {formatAmount(grandTotal)}
        </Button>
      </div>

      {/* Variant picker — opens when the cashier taps a product that
          has variants. Each row shows the variant label, sku, price,
          and per-variant stock so an out-of-stock variant is greyed
          out instead of silently failing at submit time. */}
      <Dialog
        open={!!variantPickerProduct}
        onOpenChange={(o) => !o && setVariantPickerProduct(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{variantPickerProduct?.name ?? "Pick variant"}</DialogTitle>
            <DialogDescription>Choose which variant to add to the cart.</DialogDescription>
          </DialogHeader>
          {variantPickerProduct && (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {(variantPickerProduct.variants ?? []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() =>
                    addVariantFromPicker(variantPickerProduct, v)
                  }
                  disabled={v.stockQuantity <= 0}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5 text-left hover:border-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {v.label || "(unlabeled variant)"}
                    </p>
                    {v.sku && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {v.sku}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatAmount(v.rate)}</p>
                    <Badge
                      variant={v.stockQuantity > 0 ? "outline" : "destructive"}
                      className="text-[10px]"
                    >
                      {v.stockQuantity > 0 ? `${v.stockQuantity} left` : "Out"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
