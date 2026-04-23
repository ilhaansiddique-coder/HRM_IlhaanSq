"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ScrollText } from "lucide-react";

const actionColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

export function ActivityLogsTab({ logs }: { logs: any[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entityType))),
    [logs]
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))),
    [logs]
  );

  const filtered = logs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
    if (search) {
      const haystack =
        `${log.action} ${log.entityType} ${log.user?.fullName ?? ""} ${log.user?.email ?? ""} ${JSON.stringify(log.details ?? {})}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entityTypes.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.user?.fullName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionColors[log.action] ?? "outline"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {(log.details as any)?.name ??
                          (log.details as any)?.customerName ??
                          (log.details as any)?.invoiceNumber ??
                          "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {logs.length} log entries
        </p>
      </CardContent>
    </Card>
  );
}
