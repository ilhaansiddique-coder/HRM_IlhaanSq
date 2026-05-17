"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveDateBounds } from "@/lib/date-range";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Eye,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useCurrency } from "../../_components/providers";
import { CustomerPaymentDialog } from "./customer-payment-dialog";
import { CustomerDialog } from "./customer-dialog";
import { CustomerHistoryDialog } from "./customer-history-dialog";
import { deleteCustomerAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 30;

// Serialized row passed from the server. Decimal/Date fields are
// converted to plain primitives so the client can render without
// re-importing Prisma types.
export type SerializedCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  status: string;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  pendingCount: number;
  totalSpent: number;
  creditLimit: number | null;
  /** Sum of `amount_due` across active credit-bearing sales. Drives
   *  the wallet icon's enabled/disabled state. Always 0 for the
   *  super-admin cross-tenant view. */
  creditDue: number;
  /** Due on non-credit (COD / immediate) sales. Surfaced in the
   *  outstanding-balance figure but doesn't enable the wallet icon
   *  (the credit-collection dialog only handles credit invoices). */
  otherDue: number;
  outstandingBalance: number;
  additionalInfo: string | null;
  createdAt: string;
  // Cross-tenant tagging — populated for super admin reads. Tenant
  // users get null and the column stays hidden.
  tenantId: string;
  tenantName: string | null;
};

type SortField =
  | "orderCount"
  | "deliveredCount"
  | "cancelledCount"
  | "totalSpent";
type SortDir = "asc" | "desc";

export function CustomerList({
  initialCustomers,
  showTenantColumn = false,
  readOnly = false,
}: {
  initialCustomers: SerializedCustomerRow[];
  showTenantColumn?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { formatAmount } = useCurrency();

  // Search + date filter both live in the URL so the header-slot
  // controls (rendered by tenant-shell) can drive the same state
  // the inline list reads. URL-only state means deep-links work
  // out of the box and back/forward do the right thing.
  const urlQ = params.get("q") ?? "";
  const urlRange = params.get("range");
  const urlFrom = params.get("from");
  const urlTo = params.get("to");
  const [searchInput, setSearchInput] = useState(urlQ);

  // Mirror URL → input when it changes from elsewhere (header slot,
  // back/forward). Mirror input → URL on a 200ms debounce so we don't
  // thrash router.replace on every keystroke.
  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);
  useEffect(() => {
    if (searchInput === urlQ) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (searchInput) next.set("q", searchInput);
      else next.delete("q");
      router.replace(`?${next.toString()}`, { scroll: false });
    }, 200);
    return () => clearTimeout(id);
  }, [searchInput, urlQ, params, router]);

  const dateBounds = useMemo(
    () => resolveDateBounds(urlRange, urlFrom, urlTo, "all_time"),
    [urlRange, urlFrom, urlTo]
  );

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: SortField | null; dir: SortDir }>({
    field: null,
    dir: "desc",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedCustomerRow | null>(null);

  // The TopBar `+` icon (CustomersActionsCluster) lives in the layout
  // tree and can't share React state with this component. It signals
  // "open the Add dialog" by dispatching a window event — no URL
  // pollution, no race conditions, no deep-link weirdness.
  useEffect(() => {
    const onOpenAdd = () => {
      setEditing(null);
      setDialogOpen(true);
    };
    window.addEventListener("customers:open-add-dialog", onOpenAdd);
    return () =>
      window.removeEventListener("customers:open-add-dialog", onOpenAdd);
  }, []);

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditing(null);
  }
  const [paymentTarget, setPaymentTarget] =
    useState<{ id: string; name: string } | null>(null);
  const [historyTarget, setHistoryTarget] =
    useState<{ id: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<SerializedCustomerRow | null>(null);
  const [refreshing, startRefreshing] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: SerializedCustomerRow) {
    setEditing(c);
    setDialogOpen(true);
  }
  function openPayment(c: SerializedCustomerRow) {
    if ((c.creditDue ?? 0) <= 0) return;
    setPaymentTarget({ id: c.id, name: c.name });
  }
  function openHistory(c: SerializedCustomerRow) {
    setHistoryTarget({ id: c.id, name: c.name });
  }

  function toggleSort(field: SortField) {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" }
    );
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    const fd = new FormData();
    fd.set("customerId", pendingDelete.id);
    startDeleting(async () => {
      try {
        await deleteCustomerAction(fd);
        setPendingDelete(null);
      } catch {
        // The server action throws and the AlertDialog stays open
        // so the user can retry; we don't surface a toast here
        // because there's no toast provider wired into the tenant
        // shell yet.
      }
    });
  }

  // Render the Tenant column whenever the prop says so OR whenever the
  // payload carries tenant info. Same defensive pattern as SalesList.
  const showTenant =
    showTenantColumn || initialCustomers.some((c) => !!c.tenantName);

  const filtered = useMemo(() => {
    const q = urlQ.toLowerCase();
    const matched = initialCustomers.filter((c) => {
      // Text match — name / contact / notes / tenant (super-admin only).
      const textOk =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(urlQ) ||
        c.whatsapp?.includes(urlQ) ||
        c.email?.toLowerCase().includes(q) ||
        c.additionalInfo?.toLowerCase().includes(q) ||
        (showTenant && c.tenantName?.toLowerCase().includes(q));
      if (!textOk) return false;

      // Date match — `createdAt` falls within the resolved bounds.
      // For "all_time" both bounds are null and we skip the check.
      if (dateBounds.start || dateBounds.end) {
        const created = new Date(c.createdAt);
        if (dateBounds.start && created < dateBounds.start) return false;
        if (dateBounds.end && created > dateBounds.end) return false;
      }
      return true;
    });
    if (!sort.field) return matched;
    const field = sort.field;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...matched].sort(
      (a, b) => (Number(a[field] ?? 0) - Number(b[field] ?? 0)) * factor
    );
  }, [initialCustomers, urlQ, dateBounds, sort, showTenant]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const endIndex =
    filtered.length === 0
      ? 0
      : Math.min(startIndex + PAGE_SIZE, filtered.length);
  const paginated = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  // Reset to page 1 whenever the filter narrows. Watching the URL
  // params (not local input) means a debounced typing burst only
  // resets once, not on every keystroke.
  useEffect(() => {
    setPage(1);
  }, [urlQ, dateBounds.start, dateBounds.end, sort]);

  // Clamp the page index if the result set shrinks beneath it (e.g.
  // the user is on page 4 of a 4-page list and a delete drops them
  // to 3 pages total).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // KPI numbers come off the *full* customer set (Total / Active) and
  // the *filtered* set (Filtered / Avg Order Value). The reference
  // page uses the same split.
  const totalCustomers = initialCustomers.length;
  const activeCustomers = useMemo(
    () => initialCustomers.filter((c) => c.status === "active").length,
    [initialCustomers]
  );
  const avgOrderValue = useMemo(() => {
    const purchasers = filtered.filter((c) => c.orderCount > 0);
    if (purchasers.length === 0) return 0;
    const sum = purchasers.reduce((acc, c) => acc + c.totalSpent, 0);
    return sum / purchasers.length;
  }, [filtered]);

  function handleRefresh() {
    startRefreshing(() => router.refresh());
  }

  // Desktop column count — must stay in sync with the visible <TableHead>s.
  // 9 base columns: Name, Additional Info, Phone, WhatsApp, Orders,
  // Delivered, Cancelled, Total Spent, Actions. +1 for the Tenant
  // column on super-admin reads.
  const desktopColSpan = (showTenant ? 1 : 0) + 9;

  return (
    <div className="space-y-4">
      {/* === KPI strip === */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Filtered Customers"
          value={filtered.length.toLocaleString()}
          hint="Matches the current search"
          icon={<Users className="h-4 w-4" />}
          tone="indigo"
        />
        <KpiCard
          label="Total Customers"
          value={totalCustomers.toLocaleString()}
          hint="All-time records"
          icon={<Users className="h-4 w-4" />}
          tone="emerald"
        />
        <KpiCard
          label="Active Customers"
          value={activeCustomers.toLocaleString()}
          hint="Status = active"
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="amber"
        />
        <KpiCard
          label="Avg. Order Value"
          value={formatAmount(avgOrderValue)}
          hint="Average spent per buyer"
          icon={<DollarSign className="h-4 w-4" />}
          tone="rose"
        />
      </div>

      {/* === Inline controls (mobile only) ===
          On mobile the TopBar is hidden, so we render search +
          Refresh + Add inline. On desktop the same controls live
          in the TopBar slot (CustomersHeaderControls +
          CustomersActionsCluster) so this whole row is hidden. */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={
              showTenant
                ? "Search customers, phone, notes, or tenant..."
                : "Search customers, phone, WhatsApp, or notes..."
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={openCreate} className="flex-1">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* === Desktop table ===
          The Table primitive already ships its own bordered, rounded
          scroll wrapper — no Card around it (that produced two
          stacked borders with mismatched radii in the screenshot). */}
      <div className="hidden md:block">
        <Table containerClassName="rounded-md">
          <TableHeader>
              <TableRow>
                {showTenant && <TableHead>Tenant</TableHead>}
                <TableHead>Name</TableHead>
                <TableHead>Additional Info</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>WhatsApp</TableHead>
                <SortableHead
                  label="Orders"
                  field="orderCount"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Delivered"
                  field="deliveredCount"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Cancelled"
                  field="cancelledCount"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Total Spent"
                  field="totalSpent"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={desktopColSpan}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((customer) => (
                  <TableRow key={customer.id}>
                    {showTenant && (
                      <TableCell className="text-xs">
                        {customer.tenantName ? (
                          <span className="rounded-md bg-[#034b28]/10 px-1.5 py-0.5 font-medium capitalize text-[#034b28] dark:text-[#034b28]">
                            {customer.tenantName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {customer.additionalInfo ? (
                        <Badge
                          variant="secondary"
                          className="font-normal max-w-[180px] truncate"
                          title={customer.additionalInfo}
                        >
                          {customer.additionalInfo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.whatsapp ? (
                        <a
                          href={`https://wa.me/${customer.whatsapp.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={customer.whatsapp}
                          aria-label={`Open WhatsApp chat with ${customer.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#034b28] text-white shadow-sm transition-colors hover:bg-[#023a1f]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-amber-600 dark:text-amber-400">
                      {customer.orderCount}
                    </TableCell>
                    <TableCell className="tabular-nums text-amber-600 dark:text-amber-400">
                      {customer.deliveredCount}
                    </TableCell>
                    <TableCell className="tabular-nums text-amber-600 dark:text-amber-400">
                      {customer.cancelledCount}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatAmount(customer.totalSpent)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1.5">
                        {/* Square 36px buttons — matches the mobile
                            card layout so the action cluster reads
                            the same on every viewport. Wallet stays
                            muted when there's no credit to collect. */}
                        <Button
                          variant="outline"
                          size="icon"
                          className={`!h-9 !min-h-9 !w-9 rounded-md ${
                            (customer.creditDue ?? 0) > 0
                              ? "text-amber-600 hover:text-amber-600"
                              : "text-muted-foreground/50"
                          }`}
                          onClick={() => openPayment(customer)}
                          disabled={(customer.creditDue ?? 0) <= 0}
                          aria-label={
                            (customer.creditDue ?? 0) > 0
                              ? `Collect credit (${formatAmount(customer.creditDue)} due)`
                              : "No credit due"
                          }
                          title={
                            (customer.creditDue ?? 0) > 0
                              ? `Collect credit · ${formatAmount(customer.creditDue)} due`
                              : "No credit due"
                          }
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="!h-9 !min-h-9 !w-9 rounded-md"
                          onClick={() => openHistory(customer)}
                          aria-label={`View history for ${customer.name}`}
                          title="View purchase history"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="!h-9 !min-h-9 !w-9 rounded-md"
                          onClick={() => openEdit(customer)}
                          aria-label={`Edit ${customer.name}`}
                          title="Edit customer"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="!h-9 !min-h-9 !w-9 rounded-md text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(customer)}
                          aria-label={`Delete ${customer.name}`}
                          title="Delete customer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </div>

      {/* === Mobile cards === */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" />
            <span className="text-sm">No customers found</span>
          </Card>
        ) : (
          paginated.map((customer) => {
            const hasCreditDue = (customer.creditDue ?? 0) > 0;
            return (
              <Card key={customer.id} className="rounded-lg p-4 space-y-3">
                {/* Header — Name (left) + Additional Info pill (right).
                    "No Notes" outlined badge fills the slot when the
                    customer has no extra info, mirroring the design. */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">
                    {customer.name}
                  </p>
                  <Badge
                    variant={customer.additionalInfo ? "secondary" : "outline"}
                    className="shrink-0 rounded-md font-normal"
                    title={customer.additionalInfo ?? undefined}
                  >
                    <span className="block max-w-[140px] truncate">
                      {customer.additionalInfo ?? "No Notes"}
                    </span>
                  </Badge>
                </div>

                {showTenant && customer.tenantName && (
                  <div>
                    <span className="rounded-md bg-[#034b28]/10 px-1.5 py-0.5 text-[11px] font-medium capitalize text-[#034b28] dark:text-[#034b28]">
                      {customer.tenantName}
                    </span>
                  </div>
                )}

                {/* Contact row — phone (icon + number) + WhatsApp icon
                    button. Mirrors the desktop WhatsApp icon style. */}
                <div className="flex items-center gap-3 text-sm">
                  {customer.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {customer.whatsapp && (
                    <a
                      href={`https://wa.me/${customer.whatsapp.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={customer.whatsapp}
                      aria-label={`Open WhatsApp chat with ${customer.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#034b28] text-white shadow-sm transition-colors hover:bg-[#023a1f]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* 2x2 stat grid — uppercase labels, bold values, all
                    centered. Matches the second screenshot. */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBlock label="Orders" value={customer.orderCount} />
                  <StatBlock
                    label="Delivered"
                    value={customer.deliveredCount}
                  />
                  <StatBlock
                    label="Cancelled"
                    value={customer.cancelledCount}
                  />
                  <StatBlock
                    label="Spent"
                    value={formatAmount(customer.totalSpent)}
                  />
                </div>

                {/* 4 icon-only action buttons in a row. Wallet stays
                    enabled only when there's actually credit to collect
                    (matches desktop). */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`!h-9 !min-h-9 !w-9 rounded-md ${
                      hasCreditDue
                        ? "text-amber-600 hover:text-amber-600"
                        : "text-muted-foreground/40"
                    }`}
                    onClick={() => openPayment(customer)}
                    disabled={!hasCreditDue}
                    aria-label={
                      hasCreditDue
                        ? `Collect credit (${formatAmount(customer.creditDue)} due)`
                        : "No credit due"
                    }
                  >
                    <Wallet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="!h-9 !min-h-9 !w-9 rounded-md"
                    onClick={() => openHistory(customer)}
                    aria-label={`View history for ${customer.name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="!h-9 !min-h-9 !w-9 rounded-md"
                    onClick={() => openEdit(customer)}
                    aria-label={`Edit ${customer.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="!h-9 !min-h-9 !w-9 rounded-md text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(customer)}
                    aria-label={`Delete ${customer.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* === Pagination footer === */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : startIndex + 1}–{endIndex} of{" "}
          {filtered.length}
        </p>
        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  aria-disabled={safePage === 1}
                  className={
                    safePage === 1 ? "pointer-events-none opacity-40" : ""
                  }
                />
              </PaginationItem>
              {pageWindow(safePage, totalPages).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === safePage}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  aria-disabled={safePage === totalPages}
                  className={
                    safePage === totalPages
                      ? "pointer-events-none opacity-40"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* === Dialogs ===
          The Add/Edit dialog is mounted regardless of readOnly so the
          TopBar `+` works for super admin too (the create action calls
          requireTenant() and lands the new customer in the super
          admin's own tenant). Edit mode can't be reached in readOnly
          because the per-row pencil button is gated below. */}
      <CustomerDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        initial={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                phone: editing.phone,
                email: editing.email,
                address: editing.address,
                whatsapp: editing.whatsapp,
                status: editing.status,
                creditLimit: editing.creditLimit,
                additionalInfo: editing.additionalInfo,
              }
            : undefined
        }
      />

      <CustomerPaymentDialog
        open={paymentTarget !== null}
        onOpenChange={(o) => !o && setPaymentTarget(null)}
        customerId={paymentTarget?.id ?? null}
        customerName={paymentTarget?.name ?? null}
      />

      <CustomerHistoryDialog
        open={historyTarget !== null}
        onOpenChange={(o) => !o && setHistoryTarget(null)}
        customerId={historyTarget?.id ?? null}
        customerName={historyTarget?.name ?? null}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name
                ? `"${pendingDelete.name}" will be moved to trash. Their sales history stays intact, but they'll be hidden from new searches.`
                : "This customer will be moved to trash."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

const KPI_TONES: Record<string, string> = {
  emerald: "text-[#034b28] bg-[#034b28]/10 dark:text-[#034b28]",
  indigo: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400",
  rose: "text-rose-600 bg-rose-500/10 dark:text-rose-400",
  amber: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${KPI_TONES[tone]}`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SortableHead({
  label,
  field,
  sort,
  onToggle,
  align = "left",
}: {
  label: string;
  field: SortField;
  sort: { field: SortField | null; dir: SortDir };
  onToggle: (f: SortField) => void;
  align?: "left" | "right";
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

// Centered stat block used in the mobile customer cards. Uppercase
// label on top, large bold value below — matches the second
// screenshot's 2x2 grid.
function StatBlock({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// 5-page sliding window centred on the current page, clamped to the
// available range. Same pattern the spec uses.
function pageWindow(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2)
    return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
}
