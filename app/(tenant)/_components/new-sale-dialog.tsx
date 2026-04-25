"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { useCurrency } from "./providers";
import {
  createSaleAction,
  getNewSaleFormData,
} from "../sales/actions";

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

type FormData = {
  products: Product[];
  customers: Customer[];
  paymentMethods: { id: string; name: string }[];
};

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

export function NewSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { formatAmount } = useCurrency();
  const [data, setData] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryOption, setDeliveryOption] = useState("");
  const [cnNumber, setCnNumber] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Sale date defaults to today; editable via input[type=date] in the header
  const [saleDate, setSaleDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [charge, setCharge] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [discountIsPercent, setDiscountIsPercent] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderStatus, setOrderStatus] = useState("pending");

  // Lazy-load dropdown data on first open
  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    getNewSaleFormData().then((d) => {
      if (cancelled) return;
      setData(d);
      if (d.paymentMethods[0]) setPaymentMethod(d.paymentMethods[0].name);
    });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  // Reset every field when the dialog closes
  function resetForm() {
    setCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDeliveryOption("");
    setCnNumber("");
    setAdditionalInfo("");
    setProductSearch("");
    setCart([]);
    setCharge("0");
    setDiscount("0");
    setDiscountIsPercent(true);
    setOrderStatus("pending");
    const d = new Date();
    setSaleDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    if (data?.paymentMethods[0]) setPaymentMethod(data.paymentMethods[0].name);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) resetForm();
  }

  // Customer dropdown auto-fills the rest of the customer fields
  function selectCustomer(id: string) {
    setCustomerId(id);
    const c = data?.customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? "");
      setCustomerAddress(c.address ?? "");
    }
  }

  const productResults = useMemo(() => {
    if (!data) return [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return data.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [data, productSearch]);

  function addProduct(p: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id);
      if (existing) {
        if (existing.quantity >= existing.maxStock) return prev;
        return prev.map((c) =>
          c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice: p.rate,
          quantity: 1,
          maxStock: p.stockQuantity,
        },
      ];
    });
    setProductSearch("");
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? {
                ...c,
                quantity: Math.max(0, Math.min(c.quantity + delta, c.maxStock)),
              }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }

  // ── Totals ──
  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0),
    [cart]
  );
  const chargeNum = Number(charge) || 0;
  const discountNum = Number(discount) || 0;
  const discountAmount = discountIsPercent
    ? Math.round(((subtotal * discountNum) / 100) * 100) / 100
    : discountNum;
  const grandTotal = Math.max(0, subtotal - discountAmount + chargeNum);

  function handleSubmit() {
    if (cart.length === 0) {
      toast.error("Add at least one product to the cart");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!paymentMethod) {
      toast.error("Select a payment method");
      return;
    }

    const fd = new window.FormData();
    if (saleDate) fd.set("saleDate", saleDate);
    fd.set("customerName", customerName.trim());
    if (customerPhone) fd.set("customerPhone", customerPhone);
    if (customerAddress) fd.set("customerAddress", customerAddress);
    if (customerId) fd.set("customerId", customerId);
    fd.set("paymentMethod", paymentMethod);
    fd.set("paymentStatus", "pending");
    fd.set("discountAmount", String(discountAmount));
    fd.set("charge", String(chargeNum));
    if (cnNumber) fd.set("cnNumber", cnNumber);
    const notes = [
      deliveryOption && `Delivery: ${deliveryOption}`,
      additionalInfo,
    ]
      .filter(Boolean)
      .join("\n");
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
        toast.success("Sale created");
        handleOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create sale");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            Create New Sale
          </DialogTitle>
          {/* Editable date — input[type=date] gives native picker UI.
              pr-8 leaves room for the auto-rendered Dialog close button. */}
          <div className="pr-8">
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              aria-label="Sale date"
              className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {/* ── Customer Details ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={selectCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.customers ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Address"
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Option</Label>
                <Select
                  value={deliveryOption}
                  onValueChange={setDeliveryOption}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="home_delivery">Home Delivery</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CN Number</Label>
                <Input
                  value={cnNumber}
                  onChange={(e) => setCnNumber(e.target.value)}
                  placeholder="Consignment number"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Additional Info</Label>
                <Input
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Additional info"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Add Products ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {productResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border/70 bg-card shadow-lg">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        disabled={p.stockQuantity <= 0}
                      >
                        <span className="truncate">
                          {p.name}
                          {p.sku && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.sku}
                            </span>
                          )}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatAmount(p.rate)} · {p.stockQuantity} in stock
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {cart.map((c) => (
                    <div
                      key={c.productId}
                      className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <span className="flex-1 truncate text-sm">{c.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => changeQty(c.productId, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {c.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => changeQty(c.productId, 1)}
                          disabled={c.quantity >= c.maxStock}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="w-24 text-right text-sm font-medium tabular-nums">
                        {formatAmount(c.unitPrice * c.quantity)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeFromCart(c.productId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Payment + Order Summary ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Charge</Label>
                    <Input
                      type="number"
                      min="0"
                      value={charge}
                      onChange={(e) => setCharge(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="flex h-10 items-center gap-2 rounded-md border border-border/60 px-3">
                      <Switch
                        checked={discountIsPercent}
                        onCheckedChange={setDiscountIsPercent}
                      />
                      <span className="text-xs font-medium">
                        {discountIsPercent ? "%" : "$"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Methods</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.paymentMethods ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Select value={orderStatus} onValueChange={setOrderStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <SummaryRow label="Subtotal" value={formatAmount(subtotal)} />
                <SummaryRow
                  label="Discount"
                  value={`-${formatAmount(discountAmount)}`}
                />
                <SummaryRow label="Charge" value={formatAmount(chargeNum)} />
                <div className="my-2 border-t border-border/60" />
                <SummaryRow
                  label="Grand Total"
                  value={formatAmount(grandTotal)}
                  bold
                />
                <SummaryRow label="Amount Paid" value={formatAmount(0)} />
                <SummaryRow
                  label="Amount Due"
                  value={formatAmount(grandTotal)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending || cart.length === 0 || !customerName.trim()}
            >
              {pending ? "Creating…" : "Create Sale"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          bold ? "font-semibold text-foreground" : "text-muted-foreground"
        }
      >
        {label}:
      </span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
