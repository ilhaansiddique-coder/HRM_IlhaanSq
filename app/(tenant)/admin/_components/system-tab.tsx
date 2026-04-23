"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Database,
  Shield,
  Users,
  HardDrive,
  Settings,
  Truck,
  Save,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import {
  saveCourierProviderAction,
  saveSystemSettingsAction,
} from "../actions";

export function SystemTab({
  systemStats,
  systemSettings,
  businessSettings,
  courierProviders,
}: {
  systemStats: any;
  systemSettings: any;
  businessSettings: any;
  courierProviders: any[];
}) {
  return (
    <div className="space-y-4">
      {/* System Information */}
      <Accordion type="multiple" defaultValue={["info", "system-settings"]} className="space-y-3">
        <AccordionItem value="info" className="border border-border/60 rounded-lg bg-card/80 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">System Information</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Current system status and configuration
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2 pb-2">
              <InfoTile
                icon={<Shield className="h-4 w-4 text-success" />}
                label="Authentication"
                value="NextAuth v5"
                badge={<Badge>Active</Badge>}
              />
              <InfoTile
                icon={<Database className="h-4 w-4 text-primary" />}
                label="Database"
                value="PostgreSQL + Prisma"
                badge={<Badge>Connected</Badge>}
              />
              <InfoTile
                icon={<Users className="h-4 w-4 text-secondary" />}
                label="User Signup"
                value="Admin controlled"
                badge={<Badge variant="destructive">Disabled</Badge>}
              />
              <InfoTile
                icon={<HardDrive className="h-4 w-4 text-info" />}
                label="Data Backup"
                value="Export / Import"
                badge={<Badge variant="secondary">Available</Badge>}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs text-muted-foreground">
              <Stat label="Products" value={systemStats.productCount} />
              <Stat label="Customers" value={systemStats.customerCount} />
              <Stat label="Sales" value={systemStats.saleCount} />
              <Stat label="Activity Logs" value={systemStats.activityLogCount} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* System Settings */}
        <AccordionItem value="system-settings" className="border border-border/60 rounded-lg bg-card/80 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">System Settings</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Configure currency, timezone, and other system preferences
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <form action={saveSystemSettingsAction} className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currencyCode">Currency</Label>
                  <Input
                    id="currencyCode"
                    name="currencyCode"
                    defaultValue={systemSettings?.currencyCode ?? "BDT"}
                    placeholder="BDT, USD, EUR..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currencySymbol">Currency Symbol</Label>
                  <Input
                    id="currencySymbol"
                    name="currencySymbol"
                    defaultValue={systemSettings?.currencySymbol ?? "৳"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    name="timezone"
                    defaultValue={systemSettings?.timezone ?? "Asia/Dhaka"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select name="dateFormat" defaultValue={systemSettings?.dateFormat ?? "DD/MM/YYYY"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select name="timeFormat" defaultValue={systemSettings?.timeFormat ?? "HH:mm"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HH:mm">24 Hour</SelectItem>
                      <SelectItem value="hh:mm a">12 Hour (AM/PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit">
                <Save className="h-4 w-4" />
                Save System Settings
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>

        {/* Courier Settings */}
        <AccordionItem value="courier" className="border border-border/60 rounded-lg bg-card/80 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Courier Settings</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Configure courier service integrations
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {(["steadfast", "pathao"] as const).map((provider) => {
                const existing = courierProviders.find((c) => c.provider === provider);
                return (
                  <CourierProviderCard
                    key={provider}
                    provider={provider}
                    existing={existing}
                  />
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Backup */}
        <AccordionItem value="backup" className="border border-border/60 rounded-lg bg-card/80 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <HardDrive className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Data Backup & Restore</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Export and import your data for backup and migration
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <BackupActions />
          </AccordionContent>
        </AccordionItem>

        {/* Reset App */}
        <AccordionItem value="reset" className="border border-destructive/35 rounded-lg bg-card/80 px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold">Reset App</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Reset the application to factory defaults (removes all data)
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                This will permanently delete all products, sales, customers, and settings for
                this workspace. This action cannot be undone.
              </p>
              <Button variant="destructive" disabled>
                <AlertTriangle className="h-4 w-4" />
                Reset Workspace (disabled — contact support)
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-base font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function CourierProviderCard({
  provider,
  existing,
}: {
  provider: string;
  existing: any;
}) {
  const [enabled, setEnabled] = useState(existing?.isEnabled ?? false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base capitalize">{provider}</CardTitle>
            <Badge variant={enabled ? "default" : "outline"}>
              {enabled ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={saveCourierProviderAction} className="space-y-3">
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="isEnabled" value={String(enabled)} />

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium capitalize">{provider} Courier</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? "Enabled — Orders can be sent" : "Disabled"}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                API Credentials & Auto-Refresh
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`${provider}-apiKey`} className="text-xs">
                    API Key *
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${provider}-apiKey`}
                      name="apiKey"
                      type={showApiKey ? "text" : "password"}
                      defaultValue={existing?.apiKey ?? ""}
                      placeholder="•••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${provider}-secret`} className="text-xs">
                    Secret Key *
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${provider}-secret`}
                      name="secretKey"
                      type={showSecret ? "text" : "password"}
                      defaultValue={existing?.secretKey ?? ""}
                      placeholder="•••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${provider}-refresh`} className="text-xs">
                    Auto-Refresh
                  </Label>
                  <Select name="refreshInterval" defaultValue={existing?.refreshInterval ?? "hourly"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15min">Every 15 min</SelectItem>
                      <SelectItem value="30min">Every 30 min</SelectItem>
                      <SelectItem value="hourly">Every 1 hour</SelectItem>
                      <SelectItem value="6hours">Every 6 hours</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <input
                type="hidden"
                name="autoRefresh"
                value={String(existing?.autoRefresh ?? true)}
              />
            </>
          )}

          <Button type="submit" size="sm">
            <Save className="h-4 w-4" />
            Save {provider} Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BackupActions() {
  const handleExport = async () => {
    const res = await fetch("/api/admin/backup");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Export all your data as a JSON file. Useful for backups or migrating to another instance.
      </p>
      <div className="flex gap-2">
        <Button onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Backup
        </Button>
        <Button variant="outline" disabled>
          <Upload className="h-4 w-4" />
          Import Backup (coming soon)
        </Button>
      </div>
    </div>
  );
}
