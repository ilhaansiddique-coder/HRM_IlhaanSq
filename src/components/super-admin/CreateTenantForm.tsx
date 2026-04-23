import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createTenant,
  tenantManagementQueryKeys,
  type TenantInput,
  type TenantRecord,
  updateTenant,
} from "@/services/tenantService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { generateSecurePassword, getPasswordStrength } from "@/utils/passwordUtils";
import { toast } from "@/utils/toast";

const tenantFormSchema = z
  .object({
    tenant_name: z.string().trim().min(1, "Tenant name is required."),
    tenant_email: z.string().trim().email("Enter a valid tenant email."),
    passwordMode: z.enum(["auto", "manual"]),
    password: z.string().min(1, "Password is required."),
    tenant_status: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.passwordMode === "auto" && values.password.length < 16) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Auto-generated passwords must be at least 16 characters long.",
      });
    }

    if (values.passwordMode === "manual" && values.password.length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Manual passwords must be at least 8 characters long.",
      });
    }
  });

type TenantFormValues = z.infer<typeof tenantFormSchema>;

export interface CreateTenantFormProps {
  mode?: "create" | "edit";
  tenant?: TenantRecord | null;
  embedded?: boolean;
  onCancel?: () => void;
  onSuccess?: (tenant: TenantRecord) => void;
}

const getDefaultValues = (tenant?: TenantRecord | null): TenantFormValues => ({
  tenant_name: tenant?.tenant_name ?? "",
  tenant_email: tenant?.tenant_email ?? "",
  passwordMode: tenant ? "manual" : "auto",
  password: tenant?.password ?? "",
  tenant_status: tenant ? tenant.tenant_status === "active" : true,
});

export function CreateTenantForm({
  mode = "create",
  tenant = null,
  embedded = false,
  onCancel,
  onSuccess,
}: CreateTenantFormProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const isEditMode = mode === "edit";

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    mode: "onChange",
    defaultValues: getDefaultValues(tenant),
  });

  const passwordMode = watch("passwordMode");
  const password = watch("password");
  const tenantStatus = watch("tenant_status");
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    reset(getDefaultValues(tenant));
    setShowPassword(false);
  }, [reset, tenant]);

  useEffect(() => {
    if (!tenant && passwordMode === "auto" && !password) {
      setValue("password", generateSecurePassword(), { shouldDirty: true, shouldValidate: true });
    }
  }, [password, passwordMode, setValue, tenant]);

  const tenantMutation = useMutation({
    mutationFn: async (values: TenantFormValues) => {
      const payload: TenantInput = {
        tenant_name: values.tenant_name.trim(),
        tenant_email: values.tenant_email.trim(),
        password: values.password,
        tenant_status: values.tenant_status ? "active" : "inactive",
      };

      if (isEditMode && tenant) {
        return updateTenant(tenant.id, payload);
      }

      return createTenant(payload);
    },
    onSuccess: async (savedTenant) => {
      await queryClient.invalidateQueries({ queryKey: tenantManagementQueryKeys.all });
      toast.success(isEditMode ? "Tenant updated successfully." : "Tenant created successfully.");

      if (!isEditMode) {
        reset(getDefaultValues(null));
        setValue("password", generateSecurePassword(), { shouldDirty: false, shouldValidate: false });
      }

      onSuccess?.(savedTenant);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save tenant.");
    },
  });

  const handleGeneratePassword = async () => {
    try {
      setValue("passwordMode", "auto", { shouldDirty: true, shouldValidate: true });
      setValue("password", generateSecurePassword(), { shouldDirty: true, shouldValidate: true });
      await trigger("password");
      toast.success("Secure password generated.");
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

  const formBody = (
    <form className="space-y-6" onSubmit={handleSubmit((values) => tenantMutation.mutate(values))}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={isEditMode ? "edit-tenant-name" : "create-tenant-name"}>Tenant Name</Label>
          <Input
            id={isEditMode ? "edit-tenant-name" : "create-tenant-name"}
            placeholder="RaheDeen Retail"
            autoComplete="organization"
            {...register("tenant_name")}
          />
          {errors.tenant_name && <p className="text-sm text-destructive">{errors.tenant_name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor={isEditMode ? "edit-tenant-email" : "create-tenant-email"}>Tenant Email</Label>
          <Input
            id={isEditMode ? "edit-tenant-email" : "create-tenant-email"}
            type="email"
            placeholder="admin@tenant.com"
            autoComplete="email"
            {...register("tenant_email")}
          />
          {errors.tenant_email && <p className="text-sm text-destructive">{errors.tenant_email.message}</p>}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 p-4">
        <div className="space-y-2">
          <Label>Password Mode</Label>
          <RadioGroup
            value={passwordMode}
            onValueChange={(value) =>
              setValue("passwordMode", value as TenantFormValues["passwordMode"], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="grid gap-3 md:grid-cols-2"
            aria-label="Password mode"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3">
              <RadioGroupItem value="auto" id={`${mode}-password-auto`} />
              <div className="space-y-1">
                <span className="block text-sm font-medium">Auto-generate</span>
                <span className="block text-xs text-muted-foreground">
                  Generate a strong password using secure browser crypto.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3">
              <RadioGroupItem value="manual" id={`${mode}-password-manual`} />
              <div className="space-y-1">
                <span className="block text-sm font-medium">Manual entry</span>
                <span className="block text-xs text-muted-foreground">
                  Enter a password and review its live strength score.
                </span>
              </div>
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Input
                id={`${mode}-password`}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={passwordMode === "auto" ? "Generate a secure password" : "Enter a secure password"}
                {...register("password")}
                className="pr-10"
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

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCopyPassword} disabled={!password}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              {passwordMode === "auto" && (
                <Button type="button" variant="secondary" onClick={handleGeneratePassword}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate
                </Button>
              )}
            </div>
          </div>

          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}

          {passwordMode === "manual" && (
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Password Strength</span>
                <span className="font-medium">{passwordStrength.label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", passwordStrength.colorClassName)}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{passwordStrength.feedback[0]}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
        <div className="space-y-1">
          <Label htmlFor={`${mode}-tenant-status`} className="text-sm font-medium">
            Tenant Status
          </Label>
          <p className="text-xs text-muted-foreground">
            {tenantStatus ? "Active tenants can sign in immediately." : "Inactive tenants stay disabled."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{tenantStatus ? "Active" : "Inactive"}</span>
          <Switch
            id={`${mode}-tenant-status`}
            checked={tenantStatus}
            onCheckedChange={(checked) =>
              setValue("tenant_status", checked, { shouldDirty: true, shouldValidate: true })
            }
            aria-label="Tenant status"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={tenantMutation.isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={tenantMutation.isPending}>
          {tenantMutation.isPending
            ? isEditMode
              ? "Saving..."
              : "Creating..."
            : isEditMode
              ? "Save Tenant"
              : "Create Tenant"}
        </Button>
      </div>
    </form>
  );

  if (embedded) {
    return formBody;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? "Edit Tenant" : "Create Tenant"}</CardTitle>
        <CardDescription>
          {isEditMode
            ? "Update tenant details, password mode, and active status."
            : "Provision a tenant with secure credentials and default active status."}
        </CardDescription>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}

export default CreateTenantForm;
