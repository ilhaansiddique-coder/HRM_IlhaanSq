import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Package,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";

import { usePackagingHistory, usePackagingQueue } from "@/hooks/usePackagingQueue";
import type { PackagingHistoryItem, PackagingQueueItem } from "@/modules/inventory/services/packagingService";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { formatInTimeZone } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatDateTime = (value: string | null, timezone: string) => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return formatInTimeZone(parsedDate, "MMM dd, yyyy HH:mm", timezone);
};

const getPackagedSnapshot = (details: PackagingHistoryItem["details"], key: "before" | "after") => {
  if (!details || !isRecord(details[key])) {
    return null;
  }

  const snapshot = details[key] as Record<string, unknown>;
  return typeof snapshot.packaged === "boolean" ? snapshot.packaged : null;
};

const renderAliasNames = (item: PackagingQueueItem) => {
  if (!item.alias_names.length) {
    return "-";
  }

  return item.alias_names.join(", ");
};

const getReadOnlyMessage = (message?: string) =>
  message ??
  "Packaging is running in read-only mode. Queue access is available, but pack and unpack actions are disabled.";

export function PackagingQueue() {
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<PackagingQueueItem | null>(null);
  const { systemSettings } = useSystemSettings();
  const { hasPermission } = useUserRole();

  const { data, isLoading, error, packMutation, unpackMutation } = usePackagingQueue(search);
  const historyQuery = usePackagingHistory(selectedSale?.sale_id ?? null);

  const canConfirm = hasPermission("packaging.confirm");
  const canUnpack = hasPermission("packaging.unpack");

  const queueItems = useMemo(() => data?.items ?? [], [data?.items]);
  const stats = useMemo(() => {
    const packedCount = queueItems.filter((item) => item.packaged === true).length;
    return {
      total: queueItems.length,
      packed: packedCount,
      unpacked: queueItems.length - packedCount,
    };
  }, [queueItems]);

  const packingSaleId = packMutation.isPending ? packMutation.variables : null;
  const unpackingSaleId = unpackMutation.isPending ? unpackMutation.variables : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Packaging Queue
              </CardTitle>
              <CardDescription className="mt-1">
                Confirm packed orders after sale creation. This queue does not change payment, courier, or stock flows.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice, customer, alias, seller"
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Packable Sales</div>
              <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-success/25 bg-success/10 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Packed</div>
              <div className="mt-2 text-2xl font-semibold">{stats.packed}</div>
            </div>
            <div className="rounded-lg border border-warning/25 bg-warning/10 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Awaiting Pack</div>
              <div className="mt-2 text-2xl font-semibold">{stats.unpacked}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load packaging queue."}
            </div>
          )}

          {data?.readOnly && (
            <div className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Read-only mode</div>
                  <div className="mt-1 text-xs">{getReadOnlyMessage(data.message)}</div>
                </div>
              </div>
            </div>
          )}

          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Aliases</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Packaging</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading packaging queue...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : queueItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No packable sales found.
                    </TableCell>
                  </TableRow>
                ) : (
                  queueItems.map((item) => {
                    const isPackPending = packingSaleId === item.sale_id;
                    const isUnpackPending = unpackingSaleId === item.sale_id;
                    const disablePack = data?.readOnly || !canConfirm || isPackPending || isUnpackPending;
                    const disableUnpack = data?.readOnly || !canUnpack || isPackPending || isUnpackPending;

                    return (
                      <TableRow key={item.sale_id}>
                        <TableCell className="font-medium">{item.invoice_number}</TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate" title={item.canonical_customer_name}>
                            {item.canonical_customer_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[240px] truncate text-xs text-muted-foreground" title={renderAliasNames(item)}>
                            {renderAliasNames(item)}
                          </div>
                        </TableCell>
                        <TableCell>{item.seller_name ?? "Unknown User"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.status ?? "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(item.updated_at ?? item.created_at, systemSettings.timezone)}</TableCell>
                        <TableCell>
                          {item.packaged === true ? (
                            <Badge className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Packed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock3 className="h-3 w-3" />
                              Unpacked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSale(item)}
                            >
                              <History className="mr-1 h-3.5 w-3.5" />
                              History
                            </Button>

                            {item.packaged === true ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => unpackMutation.mutate(item.sale_id)}
                                disabled={disableUnpack}
                              >
                                {isUnpackPending ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                )}
                                Unpack
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => packMutation.mutate(item.sale_id)}
                                disabled={disablePack}
                              >
                                {isPackPending ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Package className="mr-1 h-3.5 w-3.5" />
                                )}
                                Pack
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Packaging History</DialogTitle>
            <DialogDescription>
              {selectedSale
                ? `Audit trail for ${selectedSale.invoice_number} in the packaging queue.`
                : "Packaging activity history."}
            </DialogDescription>
          </DialogHeader>

          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading packaging history...
            </div>
          ) : historyQuery.error ? (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {historyQuery.error instanceof Error
                ? historyQuery.error.message
                : "Failed to load packaging history."}
            </div>
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            <div className="space-y-3">
              {historyQuery.data.map((entry) => {
                const beforePackaged = getPackagedSnapshot(entry.details, "before");
                const afterPackaged = getPackagedSnapshot(entry.details, "after");

                return (
                  <div key={entry.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{entry.action}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(entry.created_at, systemSettings.timezone)}
                          </span>
                        </div>
                        <div className="mt-2 font-medium">
                          {entry.full_name || entry.email || entry.user_id || "Unknown User"}
                        </div>
                        {entry.summary && (
                          <div className="mt-1 text-sm text-muted-foreground">{entry.summary}</div>
                        )}
                      </div>

                      {(beforePackaged !== null || afterPackaged !== null) && (
                        <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
                          <div>Before: {beforePackaged ? "Packed" : "Unpacked"}</div>
                          <div>After: {afterPackaged ? "Packed" : "Unpacked"}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No packaging activity has been recorded for this sale yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
