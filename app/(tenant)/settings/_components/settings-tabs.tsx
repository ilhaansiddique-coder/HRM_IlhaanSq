"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Sparkles } from "lucide-react";
import {
  saveBusinessSettings,
  saveSystemSettings,
  addPaymentMethodAction,
  updatePaymentMethodAction,
  togglePaymentMethodAction,
  deletePaymentMethodAction,
  seedDefaultPaymentMethodsAction,
} from "../actions";
import { LogoDropzone } from "./logo-dropzone";

export function SettingsTabs({
  business,
  system,
  paymentMethods,
}: {
  business: any;
  system: any;
  paymentMethods: any[];
}) {
  return (
    <Tabs defaultValue="business" className="w-full">
      <TabsList>
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
        <TabsTrigger value="payment">Payment Methods</TabsTrigger>
      </TabsList>

      <TabsContent value="business" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Shown on invoices and receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveBusinessSettings} className="space-y-4">
              <div className="space-y-2">
                <Label>Logo</Label>
                <LogoDropzone
                  name="logoUrl"
                  defaultValue={business?.logoUrl ?? ""}
                  businessName={business?.businessName ?? ""}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    name="businessName"
                    defaultValue={business?.businessName ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                  <Input
                    id="invoicePrefix"
                    name="invoicePrefix"
                    defaultValue={business?.invoicePrefix ?? "INV"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={business?.phone ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    defaultValue={business?.whatsapp ?? ""}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={business?.email ?? ""}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={business?.address ?? ""}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandColor">Brand Color</Label>
                  <Input
                    id="brandColor"
                    name="brandColor"
                    type="color"
                    defaultValue={business?.brandColor ?? "#2c7be5"}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowStockAlertQuantity">Low Stock Alert (qty)</Label>
                  <Input
                    id="lowStockAlertQuantity"
                    name="lowStockAlertQuantity"
                    type="number"
                    min="0"
                    defaultValue={business?.lowStockAlertQuantity ?? 10}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="invoiceFooterMessage">Invoice Footer Message</Label>
                  <Textarea
                    id="invoiceFooterMessage"
                    name="invoiceFooterMessage"
                    defaultValue={business?.invoiceFooterMessage ?? ""}
                    rows={2}
                  />
                </div>
              </div>
              <Button type="submit">Save Business Settings</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="system" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>System Preferences</CardTitle>
            <CardDescription>Currency, timezone, and date formats</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveSystemSettings} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currencySymbol">Currency Symbol</Label>
                  <Input
                    id="currencySymbol"
                    name="currencySymbol"
                    defaultValue={system?.currencySymbol ?? "৳"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currencyCode">Currency Code</Label>
                  <Input
                    id="currencyCode"
                    name="currencyCode"
                    defaultValue={system?.currencyCode ?? "BDT"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    name="timezone"
                    defaultValue={system?.timezone ?? "Asia/Dhaka"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input
                    id="dateFormat"
                    name="dateFormat"
                    defaultValue={system?.dateFormat ?? "DD/MM/YYYY"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Input
                    id="timeFormat"
                    name="timeFormat"
                    defaultValue={system?.timeFormat ?? "HH:mm"}
                  />
                </div>
              </div>
              <Button type="submit">Save System Settings</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payment" className="mt-4">
        <PaymentMethodsTab paymentMethods={paymentMethods} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Payment Methods tab ─────────────────────────────────────
// Each row carries the enriched fields the sale form depends on:
// `defaultTerms` decides whether picking the method auto-flips the
// term to "cod"/"credit"/"immediate"; `defaultPaidBehavior` decides
// whether to prefill amount_paid to the grand total or zero. `key`
// is auto-slugged from the name on create and is NOT editable —
// historical sales reference it as a plain text string.

const CORE_KEYS = new Set([
  "cash",
  "bkash",
  "nagad",
  "ibbl",
  "brac_bank",
  "dbbl",
  "city_bank",
  "al_arafah",
  "cod",
  "credit",
]);

function PaymentMethodsTab({ paymentMethods }: { paymentMethods: any[] }) {
  const [newMethod, setNewMethod] = useState("");
  const [newType, setNewType] = useState("cash");
  const [newTerms, setNewTerms] = useState("immediate");
  const [newBehavior, setNewBehavior] = useState("full");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seedPending, startSeedTransition] = useTransition();
  const [seedResult, setSeedResult] = useState<string | null>(null);

  function handleSeed() {
    setSeedResult(null);
    startSeedTransition(async () => {
      try {
        const r = await seedDefaultPaymentMethodsAction();
        setSeedResult(
          r.created === 0
            ? `All 10 default methods already present.`
            : `Added ${r.created} default method${r.created === 1 ? "" : "s"}.`
        );
      } catch (e) {
        setSeedResult(
          e instanceof Error ? `Error: ${e.message}` : "Failed to seed"
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Methods customers can use to pay. Picking a method on a sale
              auto-fills the payment term and amount paid based on the
              defaults below.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seedPending}
          >
            <Sparkles className="h-4 w-4" />
            Seed defaults
          </Button>
        </div>
        {seedResult && (
          <p className="mt-2 text-xs text-muted-foreground">{seedResult}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Add new method ── */}
        <form
          action={addPaymentMethodAction}
          className="grid gap-2 rounded-lg border border-dashed border-border/60 bg-background/40 p-3 md:grid-cols-[1fr_140px_140px_140px_auto]"
        >
          <Input
            name="name"
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
            placeholder="e.g. Rocket"
            required
          />
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="cod">COD</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="type" value={newType} />
          <Select value={newTerms} onValueChange={setNewTerms}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediate</SelectItem>
              <SelectItem value="cod">COD</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="defaultTerms" value={newTerms} />
          <Select value={newBehavior} onValueChange={setNewBehavior}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Prefill full</SelectItem>
              <SelectItem value="zero">Prefill zero</SelectItem>
              <SelectItem value="custom">Leave blank</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="defaultPaidBehavior" value={newBehavior} />
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>

        {/* ── List ── */}
        <div className="space-y-2">
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No payment methods configured. Click "Seed defaults" to add
              the canonical 10 (cash, bkash, nagad, banks, COD, credit).
            </p>
          ) : (
            paymentMethods.map((m) => {
              const isCore = m.key && CORE_KEYS.has(m.key);
              const isEditing = editingId === m.id;
              return (
                <div
                  key={m.id}
                  className="rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.key && (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {m.key}
                          </code>
                        )}
                        <Badge variant={m.isActive ? "default" : "outline"}>
                          {m.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {isCore && (
                          <Badge variant="secondary" className="text-[10px]">
                            Core
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {m.type} · term: {m.defaultTerms} · prefill:{" "}
                        {m.defaultPaidBehavior}
                        {m.feeType !== "none" &&
                          ` · fee: ${m.feeValue ?? 0}${m.feeType === "percent" ? "%" : ""}`}
                        {" · sort: "}
                        {m.sortOrder}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(isEditing ? null : m.id)}
                      >
                        {isEditing ? "Close" : "Edit"}
                      </Button>
                      <form action={togglePaymentMethodAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(!m.isActive)}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          {m.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      {/* Compact confirm modal built on the regular
                          <Dialog> (not <AlertDialog>). The shared
                          AlertDialogContent uses `grid h-full` on mobile
                          to render fullscreen — that's the wrong base
                          for a small confirm popup and was the source of
                          all the dead-space struggles. The regular
                          DialogContent is always centered, width-only
                          (no h-full), and adapts to viewport via
                          `max-w-*`. We override `max-w-6xl` → `max-w-sm`
                          to keep the box compact. The single wrapper div
                          collapses the grid `gap-4` between header +
                          footer to our own `gap-3`. The X close button
                          is hidden so the dialog has only Yes/No. */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            className="h-8 w-8 text-destructive transition-transform active:scale-90"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="!max-w-[22rem] !w-[calc(100%-2rem)] !p-5 !gap-2 max-h-[85vh] overflow-y-auto [&>button[aria-label='Close']]:hidden">
                          <div className="flex flex-col gap-3">
                            <DialogHeader className="space-y-1 text-center sm:text-center">
                              <DialogTitle className="text-center text-base font-semibold">
                                Delete &ldquo;{m.name}&rdquo;?
                              </DialogTitle>
                              <DialogDescription className="text-center text-xs leading-relaxed">
                                {isCore ? (
                                  <>
                                    <strong>{m.name}</strong> is a canonical
                                    payment method. You can recreate it
                                    later via &ldquo;Seed defaults&rdquo;.
                                    Existing sales using this method are
                                    not affected.
                                  </>
                                ) : (
                                  <>
                                    This will permanently delete{" "}
                                    <strong>{m.name}</strong>. Existing
                                    sales using this method are not
                                    affected.
                                  </>
                                )}
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="!flex-row !justify-center gap-2 sm:!justify-center sm:space-x-0">
                              <DialogClose asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="min-w-[110px] transition-transform active:scale-95"
                                >
                                  No, keep it
                                </Button>
                              </DialogClose>
                              <form action={deletePaymentMethodAction}>
                                <input type="hidden" name="id" value={m.id} />
                                <Button
                                  type="submit"
                                  className="min-w-[110px] bg-destructive text-destructive-foreground transition-transform hover:bg-destructive/90 active:scale-95"
                                >
                                  Yes, delete
                                </Button>
                              </form>
                            </DialogFooter>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {isEditing && (
                    <form
                      action={updatePaymentMethodAction}
                      className="mt-3 grid gap-2 border-t border-border/60 pt-3 md:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <div className="space-y-1">
                        <Label className="text-xs">Display name</Label>
                        <Input name="name" defaultValue={m.name} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          name="type"
                          defaultValue={m.type}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="cash">Cash</option>
                          <option value="mobile">Mobile</option>
                          <option value="bank">Bank</option>
                          <option value="cod">COD</option>
                          <option value="credit">Credit</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Default terms</Label>
                        <select
                          name="defaultTerms"
                          defaultValue={m.defaultTerms}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="immediate">Immediate</option>
                          <option value="cod">COD</option>
                          <option value="credit">Credit</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Default paid behavior</Label>
                        <select
                          name="defaultPaidBehavior"
                          defaultValue={m.defaultPaidBehavior}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="full">Prefill full amount</option>
                          <option value="zero">Prefill zero</option>
                          <option value="custom">Leave blank</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fee type</Label>
                        <select
                          name="feeType"
                          defaultValue={m.feeType ?? "none"}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="none">None</option>
                          <option value="fixed">Fixed amount</option>
                          <option value="percent">Percent of total</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fee value</Label>
                        <Input
                          name="feeValue"
                          type="number"
                          step="0.01"
                          defaultValue={
                            m.feeValue !== null && m.feeValue !== undefined
                              ? Number(m.feeValue)
                              : ""
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Sort order</Label>
                        <Input
                          name="sortOrder"
                          type="number"
                          defaultValue={m.sortOrder ?? 50}
                        />
                      </div>
                      <div className="flex items-end gap-2 md:col-span-2">
                        <Button type="submit">Save changes</Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
