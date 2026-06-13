"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReactNode } from "react";
import { saveBusinessSettings, saveSystemSettings } from "../actions";
import { LogoDropzone } from "./logo-dropzone";

export function SettingsTabs({
  business,
  system,
  salaryStructure,
}: {
  business: any;
  system: any;
  salaryStructure?: ReactNode;
}) {
  return (
    <Tabs defaultValue="business" className="w-full">
      <TabsList>
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
        {salaryStructure != null && (
          <TabsTrigger value="salary-structure">Salary Structure</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="business" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Workspace identity and contact details</CardDescription>
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
                <div className="space-y-2">
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

      {salaryStructure != null && (
        <TabsContent value="salary-structure" className="mt-4">
          {salaryStructure}
        </TabsContent>
      )}
    </Tabs>
  );
}
