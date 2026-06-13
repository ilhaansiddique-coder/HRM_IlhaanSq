"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Save,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { saveSystemSettingsAction } from "../actions";

export function SystemTab({
  systemStats,
  systemSettings,
}: {
  systemStats: any;
  systemSettings: any;
  businessSettings: any;
}) {
  return (
    <div className="space-y-4">
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
              <Stat label="Employees" value={systemStats.employeeCount} />
              <Stat label="Departments" value={systemStats.departmentCount} />
              <Stat label="Payroll Runs" value={systemStats.payrollRunCount} />
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
                This will permanently delete all employees, HR records, and
                settings for this workspace. This action cannot be undone.
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
  icon: ReactNode;
  label: string;
  value: string;
  badge: ReactNode;
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
      <p className="text-base font-semibold">{(value ?? 0).toLocaleString()}</p>
    </div>
  );
}

function BackupActions() {
  const backupHref = "/api/admin/backup";

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Export all your data as a JSON file. Useful for backups or migrating to another instance.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <a href={backupHref} download>
            <Download className="h-4 w-4" />
            Export Backup
          </a>
        </Button>
        <Button variant="outline" disabled>
          <Upload className="h-4 w-4" />
          Import Backup (coming soon)
        </Button>
      </div>
    </div>
  );
}
