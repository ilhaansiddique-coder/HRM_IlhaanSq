"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Search, Plus, Minus, Trash2, ShoppingCart, Package } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useCurrency } from "../../../_components/providers";
import { createSaleAction } from "../../actions";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  rate: number;
  stockQuantity: number;
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
  productName: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

export function POSSaleForm({
  products,
  customers,
  paymentMethods,
}: {
  products: Product[];
  customers: Customer[];
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { formatAmount, symbol } = useCurrency();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");

  // Customer state
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");

  // Totals
  const [discountAmount, setDiscountAmount] = useState(0);
  const [charge, setCharge] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.name ?? "Cash");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [products, search]);

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  const grandTotal = Math.max(0, subtotal - discountAmount + charge);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        if (existing.quantity >= p.stockQuantity) return prev;
        return prev.map((c) =>
          c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          unitPrice: p.rate,
          quantity: 1,
          maxStock: p.stockQuantity,
        },
      ];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId) return c;
          const next = c.quantity + delta;
          if (next < 1) return null;
          if (next > c.maxStock) return c;
          return { ...c, quantity: next };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function setUnitPrice(productId: string, value: number) {
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, unitPrice: value } : c))
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
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

    const fd = new FormData();
    fd.set("customerName", customerName.trim());
    if (customerPhone) fd.set("customerPhone", customerPhone);
    if (customerAddress) fd.set("customerAddress", customerAddress);
    if (customerWhatsapp) fd.set("customerWhatsapp", customerWhatsapp);
    if (customerMode === "existing" && selectedCustomerId) {
      fd.set("customerId", selectedCustomerId);
    }
    fd.set("paymentMethod", paymentMethod);
    fd.set("paymentStatus", paymentStatus);
    fd.set("discountAmount", String(discountAmount));
    fd.set("charge", String(charge));
    if (notes) fd.set("additionalInfo", notes);
    fd.set(
      "itemsJson",
      JSON.stringify(
        cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))
      )
    );

    startTransition(async () => {
      try {
        await createSaleAction(fd);
        router.push("/sales");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create sale");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* LEFT: Product picker + cart */}
      <div className="space-y-4">
        {/* Product search */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Add Products</CardTitle>
            <CardDescription>Search and tap to add to cart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="pl-9" autoFocus />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 max-h-[280px] overflow-y-auto pr-1" data-lenis-prevent>
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 col-span-2">No products found</p>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={p.stockQuantity <= 0}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5 text-left hover:border-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.sku ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatAmount(p.rate)}</p>
                      <Badge variant={p.stockQuantity > 0 ? "outline" : "destructive"} className="text-[10px]">
                        {p.stockQuantity > 0 ? `${p.stockQuantity} left` : "Out"}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />Cart ({cart.length})</CardTitle>
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
                  <div key={c.productId} className="flex items-center gap-2 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.productName}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>{symbol}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={c.unitPrice}
                          onChange={(e) => setUnitPrice(c.productId, parseFloat(e.target.value) || 0)}
                          className="h-6 w-20 text-xs px-2 py-0"
                        />
                        <span>· max {c.maxStock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.productId, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-8 text-center">{c.quantity}</span>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.productId, 1)} disabled={c.quantity >= c.maxStock}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right text-sm font-bold w-20">
                      {formatAmount(c.unitPrice * c.quantity)}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.productId)}>
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
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
              <button type="button" onClick={() => setCustomerMode("new")} className={`text-xs py-1.5 rounded ${customerMode === "new" ? "bg-background shadow-sm" : ""}`}>New</button>
              <button type="button" onClick={() => setCustomerMode("existing")} className={`text-xs py-1.5 rounded ${customerMode === "existing" ? "bg-background shadow-sm" : ""}`}>Existing</button>
            </div>
            {customerMode === "existing" && (
              <Select value={selectedCustomerId} onValueChange={selectExistingCustomer}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.length === 0 ? <SelectItem value="_none" disabled>No customers</SelectItem> : customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.phone && `(${c.phone})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} type="tel" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={2} />
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
              <Input type="number" step="0.01" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="h-7 w-24 text-right text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Shipping / Charge</Label>
              <Input type="number" step="0.01" min="0" value={charge} onChange={(e) => setCharge(parseFloat(e.target.value) || 0)} className="h-7 w-24 text-right text-sm" />
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2">
              <span className="font-bold">Grand Total</span>
              <span className="text-xl font-bold text-primary">{formatAmount(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.length === 0 ? (
                    <SelectItem value="Cash">Cash</SelectItem>
                  ) : (
                    paymentMethods.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending (will pay later)</SelectItem>
                  <SelectItem value="paid">Paid in full</SelectItem>
                  <SelectItem value="partial">Partial payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes for this sale..." />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={pending || cart.length === 0} className="w-full h-12 text-base font-bold">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Sale · {formatAmount(grandTotal)}
        </Button>
      </div>
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
