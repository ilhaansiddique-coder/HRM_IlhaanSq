"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import {
  saveBusinessSettings,
  saveSystemSettings,
  addPaymentMethodAction,
  togglePaymentMethodAction,
  deletePaymentMethodAction,
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
  const [newMethod, setNewMethod] = useState("");

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
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Methods customers can use to pay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addPaymentMethodAction} className="flex gap-2">
              <Input
                name="name"
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                placeholder="e.g., bKash, Nagad, Card..."
                required
              />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            <div className="space-y-2">
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No payment methods configured
                </p>
              ) : (
                paymentMethods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <Badge variant={m.isActive ? "default" : "outline"}>
                        {m.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <form action={togglePaymentMethodAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="isActive" value={String(!m.isActive)} />
                        <Button type="submit" variant="ghost" size="sm">
                          {m.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      <form action={deletePaymentMethodAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
