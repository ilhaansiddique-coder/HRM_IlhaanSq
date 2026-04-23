import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Input } from "@/components/ui/input";
import {
  TENANT_PERMISSION_OPTIONS,
  createRole,
  deleteRole,
  getRoles,
  getTenants,
  tenantManagementQueryKeys,
  type TenantRoleInput,
  type TenantRoleRecord,
} from "@/services/tenantService";
import { toast } from "@/utils/toast";

const roleSchema = z.object({
  role_name: z.string().trim().min(1, "Role name is required."),
  tenant_id: z.string().trim().min(1, "Tenant selection is required."),
  permissions: z.array(z.string()).min(1, "Select at least one permission."),
});

type RoleFormValues = z.infer<typeof roleSchema>;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

export interface RoleManagerProps {
  className?: string;
}

export function RoleManager({ className }: RoleManagerProps) {
  const queryClient = useQueryClient();
  const [deletingRole, setDeletingRole] = useState<TenantRoleRecord | null>(null);

  const tenantsQuery = useQuery({
    queryKey: tenantManagementQueryKeys.tenants,
    queryFn: getTenants,
  });

  const rolesQuery = useQuery({
    queryKey: tenantManagementQueryKeys.roles,
    queryFn: getRoles,
  });

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      role_name: "",
      tenant_id: "",
      permissions: [],
    },
  });

  const selectedPermissions = watch("permissions");

  const handleCreateRole = (values: RoleFormValues) => {
    const payload: TenantRoleInput = {
      role_name: values.role_name,
      tenant_id: values.tenant_id,
      permissions: values.permissions,
    };

    createRoleMutation.mutate(payload);
  };

  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantManagementQueryKeys.all });
      toast.success("Role created successfully.");
      reset({
        role_name: "",
        tenant_id: "",
        permissions: [],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create role.");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantManagementQueryKeys.all });
      toast.success("Role removed successfully.");
      setDeletingRole(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove role.");
    },
  });

  const tenantLookup = useMemo(
    () =>
      new Map((tenantsQuery.data ?? []).map((tenant) => [tenant.id, tenant.tenant_name] as const)),
    [tenantsQuery.data],
  );

  const togglePermission = (permission: string, checked: boolean) => {
    const nextPermissions = checked
      ? Array.from(new Set([...selectedPermissions, permission]))
      : selectedPermissions.filter((value) => value !== permission);

    setValue("permissions", nextPermissions, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <>
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Role Management</CardTitle>
            <CardDescription>Create tenant-specific roles and terminate them when access is no longer needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={handleSubmit(handleCreateRole)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    placeholder="Billing Manager"
                    {...register("role_name")}
                  />
                  {errors.role_name && <p className="text-sm text-destructive">{errors.role_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role-tenant">Tenant</Label>
                  <Select
                    value={watch("tenant_id")}
                    onValueChange={(value) =>
                      setValue("tenant_id", value, { shouldDirty: true, shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="role-tenant">
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tenantsQuery.data ?? []).map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.tenant_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tenant_id && <p className="text-sm text-destructive">{errors.tenant_id.message}</p>}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Permissions</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose the access scope for this tenant role.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {selectedPermissions.length} selected
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {TENANT_PERMISSION_OPTIONS.map((permission) => {
                    const checked = selectedPermissions.includes(permission);
                    return (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => togglePermission(permission, Boolean(nextChecked))}
                          aria-label={`Toggle ${permission}`}
                        />
                        <div>
                          <span className="block text-sm font-medium">{permission}</span>
                          <span className="block text-xs text-muted-foreground">
                            Assign {permission} access to this role.
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {errors.permissions && <p className="text-sm text-destructive">{errors.permissions.message}</p>}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Review tenant roles, permission sets, and remove roles with confirmation.</CardDescription>
          </CardHeader>
          <CardContent>
            {rolesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading roles...</p>
            ) : rolesQuery.error ? (
              <p className="text-sm text-destructive">
                Failed to load roles: {(rolesQuery.error as Error).message}
              </p>
            ) : (rolesQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles have been created yet.</p>
            ) : (
              <>
                <div className="md:hidden rounded-2xl border border-border/70 bg-background/30 p-3">
                  <div className="space-y-3">
                    {(rolesQuery.data ?? []).map((role) => (
                      <div key={role.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{role.role_name}</p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {tenantLookup.get(role.tenant_id) ?? role.tenant_id}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setDeletingRole(role)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Terminate
                          </Button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">Created</span>
                            <span className="justify-self-end text-right">{formatDate(role.created_at)}</span>
                          </div>
                          <div className="space-y-2">
                            <span className="block text-muted-foreground">Permissions</span>
                            <div className="flex flex-wrap gap-1.5">
                              {role.permissions.map((permission) => (
                                <Badge key={permission} variant="secondary">
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rolesQuery.data ?? []).map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.role_name}</TableCell>
                          <TableCell>{tenantLookup.get(role.tenant_id) ?? role.tenant_id}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.map((permission) => (
                                <Badge key={permission} variant="secondary">
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(role.created_at)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => setDeletingRole(role)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Terminate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(deletingRole)} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Role</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRole
                ? `Are you sure you want to remove ${deletingRole.role_name} from ${tenantLookup.get(deletingRole.tenant_id) ?? deletingRole.tenant_id}?`
                : "Are you sure you want to remove this role?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRoleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRoleMutation.isPending}
              onClick={() => deletingRole && deleteRoleMutation.mutate(deletingRole.id)}
            >
              {deleteRoleMutation.isPending ? "Removing..." : "Remove Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default RoleManager;
