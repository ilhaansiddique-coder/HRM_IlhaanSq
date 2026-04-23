import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createTenantAdmin,
  getTenants,
  getTenantDetail,
  tenantManagementQueryKeys,
  validateTenantContact,
} from "@/services/tenantService";
import {
  billingPlanDefinitions,
  billingPlanOrder,
  formatPackageLimit,
  type BillingPlanKey,
} from "@/constants/packagePlans";
import { useCurrency } from "@/hooks/useCurrency";
import { generateSecurePassword, getPasswordStrength } from "@/utils/passwordUtils";
import { toast } from "@/utils/toast";

const PAGE_SIZE = 5;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-BD", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const getWhatsAppLink = (phone?: string | null) => {
  const digits = String(phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
};

export interface TenantListProps {
  pageSize?: number;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value), "Password must include at least one uppercase letter")
  .refine((value) => /[0-9]/.test(value), "Password must include at least one number")
  .refine((value) => /[^A-Za-z0-9]/.test(value), "Password must include at least one symbol");

const createTenantSchema = z
  .object({
    tenant_name: z.string().trim().min(2, "Tenant name is required"),
    admin_email: z.string().trim().email("Enter a valid email"),
    admin_phone: z
      .string()
      .trim()
      .min(7, "Phone number is required")
      .max(20, "Phone number is too long")
      .regex(/^[\d\s+\-()]+$/, "Phone number is invalid"),
    billing_plan: z.enum(["free", "starter", "pro"]),
    password: passwordSchema,
    confirm_password: z.string().trim(),
  })
  .refine((values) => values.password === values.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

type CreateTenantFormValues = z.infer<typeof createTenantSchema>;
type TenantSearchSuggestion = {
  kind: "Tenant" | "Email" | "Phone" | "Slug";
  value: string;
};

export function TenantList({ pageSize = PAGE_SIZE }: TenantListProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { formatAmount } = useCurrency();

  const tenantsQuery = useQuery({
    queryKey: tenantManagementQueryKeys.tenants,
    queryFn: getTenants,
  });

  const tenantDetailQuery = useQuery({
    queryKey: ["tenant-detail", viewingTenantId],
    queryFn: () => getTenantDetail(viewingTenantId as string),
    enabled: Boolean(viewingTenantId),
    retry: false,
  });

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    getValues,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    mode: "onChange",
    defaultValues: {
      tenant_name: "",
      admin_email: "",
      admin_phone: "",
      billing_plan: "free",
      password: "",
      confirm_password: "",
    },
  });

  const selectedBillingPlan = watch("billing_plan");
  const password = watch("password");
  const selectedPlanDefinition = billingPlanDefinitions[selectedBillingPlan];
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    if (!isCreateDialogOpen) return;
    const currentPassword = getValues("password");
    if (!currentPassword) {
      const generated = generateSecurePassword();
      setValue("password", generated, { shouldDirty: false, shouldValidate: true });
      setValue("confirm_password", generated, { shouldDirty: false, shouldValidate: true });
    }
  }, [getValues, isCreateDialogOpen, setValue]);

  const createTenantMutation = useMutation({
    mutationFn: async (values: CreateTenantFormValues) =>
      createTenantAdmin({
        tenant_name: values.tenant_name.trim(),
        admin_email: values.admin_email.trim(),
        admin_phone: values.admin_phone.trim(),
        plan_key: values.billing_plan,
        password: values.password,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: tenantManagementQueryKeys.all });
      const emailError = result.email_error?.trim();
      const emailErrorCode = result.email_error_code?.trim();
      const emailErrorParts = [emailErrorCode, emailError].filter(Boolean);
      const emailErrorSuffix = emailErrorParts.length ? ` (${emailErrorParts.join(" - ")})` : "";
      toast.success(
        result.email_sent
          ? "Tenant created and confirmation email sent. The provided password is temporary and must be reset after first sign-in."
          : emailErrorParts.length
            ? `Tenant created. Email delivery failed${emailErrorSuffix}`
            : "Tenant created. Email delivery failed.",
      );
      setIsCreateDialogOpen(false);
      reset();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create tenant.";
      if (/email/i.test(message)) {
        setError("admin_email", { type: "server", message });
      }
      if (/phone/i.test(message)) {
        setError("admin_phone", { type: "server", message });
      }
      toast.error(message);
    },
  });

  const validateEmail = async () => {
    const email = getValues("admin_email").trim();
    if (!email) {
      clearErrors("admin_email");
      return;
    }
    try {
      const result = await validateTenantContact({ admin_email: email });
      if (result.field_errors?.admin_email) {
        setError("admin_email", { type: "server", message: result.field_errors.admin_email });
      } else {
        clearErrors("admin_email");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to validate email.");
    }
  };

  const validatePhone = async () => {
    const phone = getValues("admin_phone").trim();
    if (!phone) {
      clearErrors("admin_phone");
      return;
    }
    try {
      const result = await validateTenantContact({ admin_phone: phone });
      if (result.field_errors?.admin_phone) {
        setError("admin_phone", { type: "server", message: result.field_errors.admin_phone });
      } else {
        clearErrors("admin_phone");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to validate phone.");
    }
  };

  const handleGeneratePassword = async () => {
    try {
      const generated = generateSecurePassword();
      setValue("password", generated, { shouldDirty: true, shouldValidate: true });
      setValue("confirm_password", generated, { shouldDirty: true, shouldValidate: true });
      toast.success("Strong password generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate password.");
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied to clipboard.");
    } catch {
      toast.error("Failed to copy password.");
    }
  };

  const searchSuggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return [];
    }

    const suggestions = new Map<string, TenantSearchSuggestion>();
    const source = tenantsQuery.data ?? [];

    for (const tenant of source) {
      const candidates: TenantSearchSuggestion[] = [
        { kind: "Tenant", value: tenant.tenant_name },
        { kind: "Email", value: tenant.tenant_admin_email ?? tenant.tenant_email ?? "" },
        { kind: "Phone", value: tenant.tenant_admin_phone ?? "" },
        { kind: "Slug", value: tenant.tenant_slug ?? "" },
      ];

      for (const candidate of candidates) {
        const value = candidate.value.trim();
        if (!value || !value.toLowerCase().includes(normalizedSearch)) {
          continue;
        }

        const key = `${candidate.kind}:${value.toLowerCase()}`;
        if (!suggestions.has(key)) {
          suggestions.set(key, { ...candidate, value });
        }
      }
    }

    return Array.from(suggestions.values()).slice(0, 6);
  }, [searchTerm, tenantsQuery.data]);

  const filteredTenants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const source = tenantsQuery.data ?? [];

    if (!normalizedSearch) {
      return source;
    }

    return source.filter(
      (tenant) =>
        tenant.tenant_name.toLowerCase().includes(normalizedSearch) ||
        (tenant.tenant_admin_email ?? "").toLowerCase().includes(normalizedSearch) ||
        tenant.tenant_email.toLowerCase().includes(normalizedSearch) ||
        (tenant.tenant_admin_phone ?? "").toLowerCase().includes(normalizedSearch) ||
        (tenant.tenant_slug ?? "").toLowerCase().includes(normalizedSearch) ||
        tenant.id.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, tenantsQuery.data]);

  const handleSelectSearchSuggestion = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    setIsSearchFocused(false);
  };

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTenants = filteredTenants.slice((activePage - 1) * pageSize, activePage * pageSize);
  const welcomeEmailStatus = tenantDetailQuery.data?.welcome_email_status ?? "unknown";
  const welcomeEmailStatusLabel =
    welcomeEmailStatus === "sent"
      ? "Sent"
      : welcomeEmailStatus === "failed"
        ? "Failed"
        : welcomeEmailStatus === "skipped"
          ? "Skipped"
          : "Unknown";
  const welcomeEmailBadgeVariant =
    welcomeEmailStatus === "sent"
      ? "default"
      : welcomeEmailStatus === "failed"
        ? "destructive"
        : welcomeEmailStatus === "skipped"
          ? "secondary"
          : "outline";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>
              Browse tenants provisioned in the platform registry.
            </CardDescription>
            <p className="mt-1 text-xs text-muted-foreground">
              Tenant provisioning is managed from the Requests workflow.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
            <div className="relative w-full sm:min-w-72 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search by tenant name, phone number, email or organization name"
                className="pl-9"
                aria-label="Search tenants"
                autoComplete="off"
              />
              {isSearchFocused && searchSuggestions.length > 0 ? (
                <div className="absolute top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg">
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.kind}-${suggestion.value}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSelectSearchSuggestion(suggestion.value);
                        }}
                      >
                        <span className="truncate">{suggestion.value}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{suggestion.kind}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Tenant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenantsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tenants...</p>
          ) : tenantsQuery.error ? (
            <p className="text-sm text-destructive">
              Failed to load tenants: {(tenantsQuery.error as Error).message}
            </p>
          ) : filteredTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants found for the current filter.</p>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {paginatedTenants.map((tenant) => (
                  <div key={tenant.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{tenant.tenant_name}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {tenant.tenant_admin_email || "No admin email"}
                        </p>
                      </div>
                      <Badge variant={tenant.tenant_status === "active" ? "default" : "secondary"}>
                        {tenant.tenant_status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">ID</span>
                        <span className="max-w-[60%] truncate font-mono text-xs">{tenant.id}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Slug</span>
                        <span className="max-w-[60%] truncate font-mono text-xs">{tenant.tenant_slug ?? "-"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Admin Phone</span>
                        {tenant.tenant_admin_phone ? (
                          <a
                            href={getWhatsAppLink(tenant.tenant_admin_phone) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[60%] truncate font-mono text-xs text-primary underline"
                          >
                            {tenant.tenant_admin_phone}
                          </a>
                        ) : (
                          <span className="max-w-[60%] truncate text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(tenant.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Users</span>
                        <span>{tenant.users_count}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" size="sm" onClick={() => setViewingTenantId(tenant.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" disabled title="Editing tenants is not available yet.">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* <TableHead>ID</TableHead> */}
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Admin Email</TableHead>
                      <TableHead>Admin Phone</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subscribed At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        {/* <TableCell className="font-mono text-xs">{tenant.id}</TableCell> */}
                        <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                        <TableCell className="font-mono text-xs">{tenant.tenant_admin_email || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {tenant.tenant_admin_phone ? (
                            <a
                              href={getWhatsAppLink(tenant.tenant_admin_phone) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline"
                            >
                              {tenant.tenant_admin_phone}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{tenant.users_count}</TableCell>
                        <TableCell>
                          <Badge variant={tenant.tenant_status === "active" ? "default" : "secondary"}>
                            {tenant.tenant_status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(tenant.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingTenantId(tenant.id)}
                              aria-label={`View ${tenant.tenant_name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${tenant.tenant_name}`}
                              disabled
                              title="Editing tenants is not available yet."
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(activePage - 1) * pageSize + 1} to{" "}
                  {Math.min(activePage * pageSize, filteredTenants.length)} of {filteredTenants.length} tenants
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={activePage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {activePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={activePage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(viewingTenantId)}
        onOpenChange={(open) => !open && setViewingTenantId(null)}
      >
        <DialogContent className="max-w-3xl" aria-label="Tenant details">
          <DialogHeader>
            <DialogTitle>Tenant Overview</DialogTitle>
            <DialogDescription>
              Key activity and revenue data for the selected tenant.
            </DialogDescription>
          </DialogHeader>
          {tenantDetailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tenant details...</p>
          ) : tenantDetailQuery.error ? (
            <p className="text-sm text-destructive">
              Failed to load tenant details: {(tenantDetailQuery.error as Error).message}
            </p>
          ) : tenantDetailQuery.data ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{tenantDetailQuery.data.tenant_name}</p>
                    <p className="text-sm text-muted-foreground">{tenantDetailQuery.data.tenant_slug}</p>
                  </div>
                  <Badge variant={tenantDetailQuery.data.tenant_status === "active" ? "default" : "secondary"}>
                    {tenantDetailQuery.data.tenant_status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Welcome Email</p>
                    <p className="text-xs text-muted-foreground">
                      {welcomeEmailStatus === "sent"
                        ? "Delivery confirmed."
                        : welcomeEmailStatus === "failed"
                          ? "Delivery failed."
                          : welcomeEmailStatus === "skipped"
                            ? "Delivery skipped."
                            : "Delivery status unavailable."}
                    </p>
                  </div>
                  <Badge variant={welcomeEmailBadgeVariant}>{welcomeEmailStatusLabel}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  {tenantDetailQuery.data.welcome_email_sent_at ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Sent at</span>
                      <span>{formatDateTime(tenantDetailQuery.data.welcome_email_sent_at)}</span>
                    </div>
                  ) : null}
                  {tenantDetailQuery.data.welcome_email_error_code ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Error Code</span>
                      <span className="font-mono text-xs">
                        {tenantDetailQuery.data.welcome_email_error_code}
                      </span>
                    </div>
                  ) : null}
                  {tenantDetailQuery.data.welcome_email_error ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Error</span>
                      <span className="text-right">
                        {tenantDetailQuery.data.welcome_email_error}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Users" value={tenantDetailQuery.data.users_count} />
                <StatCard label="Customers" value={tenantDetailQuery.data.customers_count} />
                <StatCard label="Products" value={tenantDetailQuery.data.products_count} />
                <StatCard label="Orders (Total)" value={tenantDetailQuery.data.total_order_quantity} />
                <StatCard
                  label="Revenue (Total)"
                  value={formatAmount(tenantDetailQuery.data.total_transaction_amount)}
                />
                <StatCard label="Orders (7d)" value={tenantDetailQuery.data.week_order_quantity} />
                <StatCard
                  label="Revenue (7d)"
                  value={formatAmount(tenantDetailQuery.data.week_transaction_amount)}
                />
                <StatCard label="Orders (Today)" value={tenantDetailQuery.data.daily_order_quantity} />
                <StatCard
                  label="Revenue (Today)"
                  value={formatAmount(tenantDetailQuery.data.daily_transaction_amount)}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl" aria-label="Create tenant">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
            <DialogDescription>
              Provision a tenant admin account and send a confirmation email automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-6"
            onSubmit={handleSubmit((values) => createTenantMutation.mutate(values))}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input id="tenant-name" placeholder="RaheDeen Retail" {...register("tenant_name")} />
                {errors.tenant_name && (
                  <p className="text-sm text-destructive">{errors.tenant_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email</Label>
                {(() => {
                  const emailRegister = register("admin_email");
                  return (
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@tenant.com"
                      autoComplete="email"
                      {...emailRegister}
                      onBlur={(event) => {
                        emailRegister.onBlur(event);
                        void validateEmail();
                      }}
                    />
                  );
                })()}
                {errors.admin_email && (
                  <p className="text-sm text-destructive">{errors.admin_email.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="admin-phone">Admin Phone</Label>
                {(() => {
                  const phoneRegister = register("admin_phone");
                  return (
                    <Input
                      id="admin-phone"
                      placeholder="+8801XXXXXXXXX"
                      {...phoneRegister}
                      onBlur={(event) => {
                        phoneRegister.onBlur(event);
                        void validatePhone();
                      }}
                    />
                  );
                })()}
                {errors.admin_phone && (
                  <p className="text-sm text-destructive">{errors.admin_phone.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tenant-package">Tenant Package</Label>
                <Select
                  value={selectedBillingPlan}
                  onValueChange={(value: BillingPlanKey) =>
                    setValue("billing_plan", value, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <SelectTrigger id="tenant-package">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {billingPlanOrder.map((planKey) => {
                      const plan = billingPlanDefinitions[planKey];
                      return (
                        <SelectItem key={planKey} value={planKey}>
                          {plan.label} · {plan.priceLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedPlanDefinition.label}</Badge>
                    <Badge variant={selectedBillingPlan === "free" ? "secondary" : "default"}>
                      {selectedPlanDefinition.priceLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedPlanDefinition.billingDescription}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 px-2 py-1">
                      {formatPackageLimit(selectedPlanDefinition.usageLimits.products, "products")}
                    </span>
                    <span className="rounded-full border border-border/70 px-2 py-1">
                      {formatPackageLimit(selectedPlanDefinition.usageLimits.customers, "customers")}
                    </span>
                    <span className="rounded-full border border-border/70 px-2 py-1">
                      {formatPackageLimit(selectedPlanDefinition.usageLimits.sales, "sales")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Password</Label>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters, with uppercase, number, and symbol.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyPassword} disabled={!password}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={handleGeneratePassword}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-confirm-password">Re-enter Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirm_password")}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirm_password && (
                    <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Password Strength</span>
                  <span className="font-medium">{passwordStrength.label}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`${passwordStrength.colorClassName} h-full rounded-full transition-all`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{passwordStrength.feedback[0]}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createTenantMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTenantMutation.isPending}>
                {createTenantMutation.isPending ? "Creating..." : "Create Tenant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default TenantList;
