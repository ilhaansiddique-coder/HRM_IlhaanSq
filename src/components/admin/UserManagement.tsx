import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/utils/toast";
import { Plus, UserCheck, UserX, Shield, Users, Edit, Trash2, User, ExternalLink, Box, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { defaultPermissionsByRole } from "@/constants/permissions";
import {
  billingPlanDefinitions,
  billingPlanOrder,
  formatPackageLimit,
  type BillingPlanKey,
} from "@/constants/packagePlans";
import { useUserRole } from "@/core/auth/useUserRole";
import { useTenantMembership } from "@/core/tenants/useTenantMembership";
import { normalizeRole, ROLES, ROLE_LABELS, type Role } from "@/types/roles";
import { listTenantUsers } from "@/core/tenants/tenantUserService";
import {
  getTenantBillingPlan,
  tenantManagementQueryKeys,
  updateTenantBillingPlan,
} from "@/core/tenants/tenantService";
import { appLogger } from "@/utils/logger";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserFormData {
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
}
type EditablePermissionRole = "manager" | "staff" | "viewer";
type EditablePermissionRoleWithAdmin = "tenant_admin" | EditablePermissionRole;
type PermissionTab =
  | "general"
  | "products_inventory"
  | "sales_invoices"
  | "customers"
  | "hr_management"
  | "reports"
  | "settings"
  | "administration";

const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  superadmin: "destructive",
  tenant_admin: "destructive",
  manager: "default",
  staff: "secondary",
  viewer: "outline",
};

const roleIcons: Record<string, ComponentType<{ className?: string }>> = {
  superadmin: Shield,
  tenant_admin: Shield,
  manager: Users,
  staff: User,
  viewer: User,
  admin: Shield,
  warehouse: Box,
};

const initialFormData: UserFormData = {
  full_name: '',
  email: '',
  phone: '',
  role: ROLES.STAFF,
  password: ''
};

const basePermissionRoleOptions: Array<{ value: EditablePermissionRole; label: string }> = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer" },
];

const PERMISSIONS: Record<PermissionTab, { label: string; key: string; description: string }[]> = {
  general: [
    { key: 'access.dashboard', label: 'Dashboard Access', description: 'Access to the main dashboard overview.' },
    { key: 'access.alerts', label: 'Alerts Access', description: 'View system alerts and notifications.' },
  ],
  products_inventory: [
    { key: 'products.view', label: 'View Products', description: 'View product catalog.' },
    { key: 'inventory.view', label: 'View Inventory', description: 'View stock levels and inventory.' },
    { key: 'products.add', label: 'Add Products', description: 'Create new products.' },
    { key: 'products.edit', label: 'Edit Products', description: 'Modify existing products.' },
    { key: 'products.duplicate', label: 'Duplicate Products', description: 'Duplicate existing products.' },
    { key: 'inventory.adjust_stock', label: 'Adjust Stock', description: 'Make stock adjustments and log changes.' },
    { key: 'products.import_export', label: 'Import/Export Products', description: 'Import or export product data.' },
    { key: 'products.delete', label: 'Delete Products', description: 'Remove products from catalog.' },
  ],
  sales_invoices: [
    { key: 'sales.view', label: 'View Sales', description: 'View sales history and POS page.' },
    { key: 'sales.view_history', label: 'View Sales History', description: 'Access sales review and history mode.' },
    { key: 'invoices.view', label: 'View Invoices', description: 'Access and view invoices.' },
    { key: 'sales.create', label: 'Create Sales (POS)', description: 'Create sales via POS.' },
    { key: 'sales.edit', label: 'Edit Sales', description: 'Modify existing sales.' },
    { key: 'packaging.view', label: 'View Packaging Queue', description: 'Load the packaging queue and packaging history.' },
    { key: 'packaging.confirm', label: 'Confirm Packed Orders', description: 'Mark eligible sales as packed.' },
    { key: 'packaging.unpack', label: 'Reverse Packed State', description: 'Return packed sales to unpacked state.' },
    { key: 'invoices.download_print', label: 'Download/Print Invoices', description: 'Download or print invoice PDFs.' },
    { key: 'invoices.export', label: 'Export Invoices', description: 'Export invoice data.' },
    { key: 'courier.send', label: 'Send to Courier', description: 'Send orders to courier service and view courier status.' },
    { key: 'courier.refresh', label: 'Refresh Courier Status', description: 'Refresh courier status for orders (individual and bulk).' },
    { key: 'sales.delete', label: 'Delete Sales', description: 'Delete or void sales.' },
  ],
  customers: [
    { key: 'customers.view', label: 'View Customers', description: 'View customer list and details.' },
    { key: 'customers.view_history', label: 'View Customer History', description: 'View purchase history for customers.' },
    { key: 'customers.add', label: 'Add Customers', description: 'Create new customer profiles.' },
    { key: 'customers.edit', label: 'Edit Customers', description: 'Modify customer details.' },
    { key: 'customers.import_export', label: 'Import/Export Customers', description: 'Import or export customers.' },
    { key: 'customers.delete', label: 'Delete Customers', description: 'Remove customers.' },
  ],
  hr_management: [
    { key: 'hr.view', label: 'View HR Management', description: 'Open the HR Management module and placeholder workspace.' },
  ],
  reports: [
    { key: 'reports.view', label: 'View Reports', description: 'Access reports and analytics.' },
    { key: 'reports.export', label: 'Export Reports', description: 'Export report data.' },
    { key: 'logs.view', label: 'View Activity Logs', description: 'View activity logs for sales, products, and customers.' },
  ],
  settings: [
    { key: 'settings.view_business', label: 'View Business Settings', description: 'View business & system settings.' },
    { key: 'settings.edit_business', label: 'Edit Business Settings', description: 'Edit business & system settings.' },
    { key: 'billing.view', label: 'View Billing', description: 'View tenant billing status and subscription details.' },
    { key: 'billing.edit', label: 'Manage Billing', description: 'Start checkout sessions and open the billing portal.' },
    { key: 'settings.manage_notifications', label: 'Manage Notifications', description: 'Configure notification preferences.' },
    { key: 'settings.manage_appearance', label: 'Manage Appearance', description: 'Change theme and layout preferences.' },
    { key: 'settings.change_password', label: 'Change Password (Self)', description: 'Change own account password.' },
  ],
  administration: [
    { key: 'admin.manage_roles', label: 'Manage User Roles', description: 'Create and edit user roles.' },
    { key: 'admin.manage_permissions', label: 'Manage User Permissions', description: 'Control role-based permissions.' },
    { key: 'admin.full_backup', label: 'Full Data Backup', description: 'Export full system backup.' },
    { key: 'admin.data_restore', label: 'Data Restore', description: 'Restore data from backup.' },
  ],
};

const PERMISSION_TABS = [
  'general',
  'products_inventory',
  'sales_invoices',
  'customers',
  'hr_management',
  'reports',
  'settings',
  'administration',
] as const satisfies readonly PermissionTab[];

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS).flat().map((permission) => permission.key);

const keysByTab = (tab: PermissionTab) => PERMISSIONS[tab].map((permission) => permission.key);

const getPermissionRoleCandidates = (role: EditablePermissionRoleWithAdmin): string[] =>
  role === "tenant_admin" ? ["tenant_admin", "admin"] : [role];

interface UserManagementProps {
  tenantIdOverride?: string | null;
  allowTenantAdminPermissionEditing?: boolean;
  initialPermissionRole?: EditablePermissionRoleWithAdmin;
}

export function UserManagement({
  tenantIdOverride,
  allowTenantAdminPermissionEditing = false,
  initialPermissionRole,
}: UserManagementProps = {}) {
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "staff" | "member">("member");
  const [inviteLink, setInviteLink] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission, userRole } = useUserRole();
  const { tenantId: membershipTenantId, isLoading: tenantLoading } = useTenantMembership();
  const effectiveTenantId = tenantIdOverride ?? membershipTenantId;
  const isTenantContextLoading = tenantIdOverride === undefined ? tenantLoading : false;
  const hasTenantContext = Boolean(effectiveTenantId);
  const showTenantPackageSelector = tenantIdOverride !== undefined && hasTenantContext;
  const canManageRoles = hasPermission('admin.manage_roles');
  const canManagePermissions = hasPermission('admin.manage_permissions');

  // Debug logging
  appLogger.debug('UserManagement Permissions:', {
    userRole,
    canManageRoles,
    canManagePermissions,
    hasManageRolesRaw: hasPermission('admin.manage_roles'),
    hasManagePermissionsRaw: hasPermission('admin.manage_permissions')
  });
  // Role Permission Management state
  const [selectedRole, setSelectedRole] = useState<EditablePermissionRoleWithAdmin>(() => {
    if (initialPermissionRole === "tenant_admin" && !allowTenantAdminPermissionEditing) {
      return "staff";
    }

    if (initialPermissionRole) {
      return initialPermissionRole;
    }

    return allowTenantAdminPermissionEditing ? "tenant_admin" : "staff";
  });
  const [activeTab, setActiveTab] = useState(
    'general' as PermissionTab
  );
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [selectedTenantPackage, setSelectedTenantPackage] = useState<BillingPlanKey>("free");
  const permissionRoleOptions = allowTenantAdminPermissionEditing
    ? [{ value: "tenant_admin" as const, label: "Tenant Admin" }, ...basePermissionRoleOptions]
    : basePermissionRoleOptions;
  const { data: tenantBillingPlan } = useQuery({
    queryKey: effectiveTenantId
      ? tenantManagementQueryKeys.billing(effectiveTenantId)
      : ["tenant-management", "tenant-billing", "none"],
    queryFn: () => getTenantBillingPlan(effectiveTenantId as string),
    enabled: showTenantPackageSelector,
    staleTime: 0,
  });
  const currentTenantPackage = tenantBillingPlan?.plan_key ?? "free";
  const selectedTenantPackageDefinition = billingPlanDefinitions[selectedTenantPackage];

  useEffect(() => {
    if (!showTenantPackageSelector) {
      setSelectedTenantPackage("free");
      return;
    }

    setSelectedTenantPackage(currentTenantPackage);
  }, [currentTenantPackage, showTenantPackageSelector]);

  // Load current permissions for the selected role
  const { data: rolePerms, isLoading: permsLoading } = useQuery({
    queryKey: ["role-permissions-editor", effectiveTenantId, selectedRole],
    queryFn: async () => {
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const { data, error } = await (supabase as any)
        .from('tenant_role_permissions')
        .select('permission_key, allowed, role')
        .eq('tenant_id', effectiveTenantId)
        .in('role', getPermissionRoleCandidates(selectedRole))
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { permission_key: string; allowed: boolean; role?: string }[];
    },
    staleTime: 0,
    enabled: !!effectiveTenantId,
  });

  useEffect(() => {
    if (!allowTenantAdminPermissionEditing && selectedRole === "tenant_admin") {
      setSelectedRole("staff");
    }
  }, [allowTenantAdminPermissionEditing, selectedRole]);

  useEffect(() => {
    if (permsLoading) {
      return;
    }

    const normalizedSelectedRole = normalizeRole(selectedRole) ?? ROLES.STAFF;
    const nextToggles: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach((key) => {
      nextToggles[key] = false;
    });

    if (!rolePerms || rolePerms.length === 0) {
      const fallbacks = defaultPermissionsByRole[normalizedSelectedRole] || [];
      if (fallbacks.includes("*")) {
        ALL_PERMISSION_KEYS.forEach((key) => {
          nextToggles[key] = true;
        });
      }

      fallbacks.forEach((key) => {
        if (key !== "*") {
          nextToggles[key] = true;
        }
      });
    } else {
      const rolePriorities = new Map(
        getPermissionRoleCandidates(selectedRole).map((role, index) => [role, index] as const),
      );
      const resolvedEntries = new Map<string, { allowed: boolean; priority: number }>();

      rolePerms.forEach((permissionRow) => {
        const permissionKey = String(permissionRow.permission_key ?? "");
        const roleKey = String(permissionRow.role ?? selectedRole);
        const priority = rolePriorities.get(roleKey) ?? Number.MAX_SAFE_INTEGER;
        const current = resolvedEntries.get(permissionKey);

        if (!current || priority < current.priority) {
          resolvedEntries.set(permissionKey, { allowed: !!permissionRow.allowed, priority });
        }
      });

      resolvedEntries.forEach((value, permissionKey) => {
        if (permissionKey === "*") {
          ALL_PERMISSION_KEYS.forEach((key) => {
            nextToggles[key] = value.allowed;
          });
          return;
        }

        nextToggles[permissionKey] = value.allowed;
      });
    }

    setToggles(nextToggles);
  }, [permsLoading, rolePerms, selectedRole]);

  const { data: users, isLoading: usersLoading, error } = useQuery({
    queryKey: ["admin-users", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      try {
        return (await listTenantUsers(effectiveTenantId)) as UserProfile[];
      } catch (err) {
        console.error('Error fetching users:', err);
        throw new Error(err instanceof Error ? err.message : 'Failed to fetch users');
      }
    },
    enabled: !!effectiveTenantId,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    retry: 2
  });

  const isLoading = isTenantContextLoading || usersLoading;

  const applyTenantPackageSelection = async () => {
    if (!showTenantPackageSelector || !effectiveTenantId) {
      return;
    }

    if (selectedTenantPackage === currentTenantPackage) {
      return;
    }

    await updateTenantBillingPlan({
      tenant_id: effectiveTenantId,
      plan_key: selectedTenantPackage,
    });

    await queryClient.invalidateQueries({ queryKey: tenantManagementQueryKeys.billing(effectiveTenantId) });
    await queryClient.invalidateQueries({ queryKey: ["tenant-billing"] });
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      appLogger.debug('Creating user with data:', { ...userData, password: '***' });
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const refreshed = await supabase.auth.refreshSession();
      let accessToken = refreshed.data.session?.access_token ?? null;
      let sessionError = refreshed.error;
      if (!accessToken) {
        const fallback = await supabase.auth.getSession();
        accessToken = fallback.data.session?.access_token ?? null;
        sessionError = sessionError || fallback.error;
      }
      if (sessionError || !accessToken) {
        throw new Error('Missing auth session. Please sign out and sign in again.');
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          tenantId: effectiveTenantId,
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
        },
      });

      if (error) {
        throw new Error(error.message || 'Edge Function error');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: async () => {
      let packageUpdated = false;
      try {
        await applyTenantPackageSelection();
        packageUpdated = showTenantPackageSelector && selectedTenantPackage !== currentTenantPackage;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "User created, but tenant package update failed.");
      }

      toast.success(packageUpdated ? "User created and tenant package updated successfully!" : "User created successfully!");
      setFormData(initialFormData);
      setIsAddDialogOpen(false);
      // Force refresh the users list
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.refetchQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      console.error('Create user mutation error:', error);
      toast.error(`Failed to create user: ${error.message}`);
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, ...userData }: { userId: string } & Partial<UserFormData>) => {
      appLogger.debug('Updating user:', userId, userData);
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const refreshed = await supabase.auth.refreshSession();
      let accessToken = refreshed.data.session?.access_token ?? null;
      let sessionError = refreshed.error;
      if (!accessToken) {
        const fallback = await supabase.auth.getSession();
        accessToken = fallback.data.session?.access_token ?? null;
        sessionError = sessionError || fallback.error;
      }
      if (sessionError || !accessToken) {
        throw new Error('Missing auth session. Please sign out and sign in again.');
      }

      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          tenantId: effectiveTenantId,
          userId,
          full_name: userData.full_name,
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          password: userData.password,
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`Failed to update user: ${error.message}`);
      }

      if (data?.error) {
        console.error('Edge Function returned error:', data.error);
        throw new Error(data.error);
      }

      appLogger.debug('User updated successfully via Edge Function');
      return { success: true };
    },
    onSuccess: async () => {
      let packageUpdated = false;
      try {
        await applyTenantPackageSelection();
        packageUpdated = showTenantPackageSelector && selectedTenantPackage !== currentTenantPackage;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "User updated, but tenant package update failed.");
      }

      toast.success(packageUpdated ? "User updated and tenant package updated successfully!" : "User updated successfully!");
      setEditingUser(null);
      setIsEditDialogOpen(false);
      setFormData(initialFormData);
      // Force refresh the users list
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.refetchQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      console.error('Update user error:', error);
      toast.error(`Failed to update user: ${error.message}`);
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      appLogger.debug('Deleting user:', userId);
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const refreshed = await supabase.auth.refreshSession();
      let accessToken = refreshed.data.session?.access_token ?? null;
      let sessionError = refreshed.error;
      if (!accessToken) {
        const fallback = await supabase.auth.getSession();
        accessToken = fallback.data.session?.access_token ?? null;
        sessionError = sessionError || fallback.error;
      }
      if (sessionError || !accessToken) {
        throw new Error('Missing auth session. Please sign out and sign in again.');
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ userId, tenantId: effectiveTenantId })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || response.statusText || 'Edge Function returned a non-2xx status code';
        throw new Error(`Failed to delete user: ${message}`);
      }

      appLogger.debug('User deleted successfully');
      return { success: true, message: 'User deleted completely' };
    },
    onSuccess: async () => {
      toast.success("User deleted successfully!");
      // Force refresh the users list
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.refetchQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      console.error('Delete user error:', error);
      toast.error(`Failed to delete user: ${error.message}`);
    }
  });

  // Permission save mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      appLogger.debug('Saving permissions for role:', selectedRole);
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const payload = Object.entries(toggles).map(([permission_key, allowed]) => ({
        permission_key,
        allowed,
        source: "tenant_admin_override",
      }));

      appLogger.debug('Payload:', payload.slice(0, 3), '... (total:', payload.length, 'items)');

      const { error } = await (supabase as any).rpc('replace_tenant_role_permissions_atomic', {
        target_tenant_id: effectiveTenantId,
        target_role: selectedRole,
        permission_rows: payload,
      });

      if (error) {
        console.error('Atomic permission save error:', error);
        throw new Error(`Failed to save permissions: ${error.message}`);
      }

      appLogger.debug('Permissions saved successfully');
    },
    onSuccess: () => {
      toast.success('Permissions updated');
      queryClient.invalidateQueries({ queryKey: ["role-permissions-editor", effectiveTenantId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions", effectiveTenantId, selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["userRole"] });
    },
    onError: (e: any) => {
      console.error('Save permissions error:', e);
      toast.error(`Failed to save: ${e.message}`);
    }
  });

  // Permission dependencies: if you enable a permission, auto-enable its prerequisites
  const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
    // Products
    'products.add': ['products.view'],
    'products.edit': ['products.view'],
    'products.duplicate': ['products.view'],
    'products.delete': ['products.view', 'products.edit'],
    'products.import_export': ['products.view'],
    // Inventory
    'inventory.adjust_stock': ['inventory.view'],
    // Sales
    'sales.view_history': ['sales.view'],
    'sales.create': ['sales.view', 'products.view'],
    'sales.edit': ['sales.view'],
    'sales.delete': ['sales.view', 'sales.edit'],
    // Courier
    'courier.send': ['sales.view'],
    'courier.refresh': ['sales.view'],
    // Invoices
    'invoices.download_print': ['invoices.view'],
    'invoices.export': ['invoices.view'],
    // Customers
    'customers.add': ['customers.view'],
    'customers.edit': ['customers.view'],
    'customers.delete': ['customers.view', 'customers.edit'],
    'customers.import_export': ['customers.view'],
    'customers.view_history': ['customers.view'],
    // Reports
    'reports.export': ['reports.view'],
    // Settings
    'billing.edit': ['billing.view'],
    'settings.edit_business': ['settings.view_business'],
  };

  const togglePermission = (key: string) => {
    setToggles(prev => {
      const newValue = !prev[key];
      const updated = { ...prev, [key]: newValue };

      // If enabling, auto-enable dependencies
      if (newValue && PERMISSION_DEPENDENCIES[key]) {
        PERMISSION_DEPENDENCIES[key].forEach(dep => {
          updated[dep] = true;
        });
      }

      // If disabling, auto-disable dependents
      if (!newValue) {
        Object.entries(PERMISSION_DEPENDENCIES).forEach(([perm, deps]) => {
          if (deps.includes(key)) {
            updated[perm] = false;
          }
        });
      }

      return updated;
    });
  };
  const allInTabOn = keysByTab(activeTab).every(k => !!toggles[k]);
  const setAllInTab = (value: boolean) => {
    const next = { ...toggles };
    keysByTab(activeTab).forEach(k => { next[k] = value; });
    setToggles(next);
  };

  const handleCreateUser = () => {
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Please fill in all required fields (name, email, and password)");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      password: '' // Don't prefill password
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser || !formData.full_name.trim() || !formData.email.trim()) {
      toast.error("Please fill in required fields");
      return;
    }
    if (formData.password.trim() && formData.password.trim().length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    updateUserMutation.mutate({
      userId: editingUser.id,
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone || null,
      role: formData.role,
      password: formData.password.trim() || undefined,
    });
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }

    setIsInviting(true);
    setInviteLink("");
    try {
      if (!effectiveTenantId) {
        throw new Error("No active tenant found");
      }

      const { data, error } = await supabase.functions.invoke("tenant-invite-create", {
        body: {
          tenantId: effectiveTenantId,
          email: inviteEmail.trim(),
          role: inviteRole,
          invite_base_url: `${window.location.origin}/invite`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create invite");
      }

      const link = data?.invite_link || `${window.location.origin}/invite?invite=${data?.invite?.token}`;
      setInviteLink(link);
      toast.success("Invite created");
    } catch (error: any) {
      toast.error(error.message || "Failed to create invite");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied");
    } catch {
      toast.error("Failed to copy invite link");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Create and manage user accounts</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!hasTenantContext}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                  <DialogDescription>
                    Generate a secure invite link for a new team member.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invite_email">Email *</Label>
                    <Input
                      id="invite_email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invite_role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: "admin" | "manager" | "staff" | "member") => setInviteRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Sales Associate</SelectItem>
                        <SelectItem value="member">Store Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteLink && (
                    <div className="space-y-2">
                      <Label>Invite Link</Label>
                      <div className="flex gap-2">
                        <Input value={inviteLink} readOnly />
                        <Button type="button" variant="secondary" onClick={handleCopyInvite}>
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleCreateInvite}
                    disabled={isInviting}
                    className="w-full"
                  >
                    {isInviting ? "Creating..." : "Create Invite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!hasTenantContext}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with email, password, and role assignment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="add_full_name">Full Name *</Label>
                    <Input
                      id="add_full_name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add_email">Email Address *</Label>
                    <Input
                      id="add_email"
                      type="email"
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add_phone">Phone Number</Label>
                    <Input
                      id="add_phone"
                      placeholder="+1234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add_password">Password *</Label>
                    <PasswordInput
                      id="add_password"
                      placeholder="Enter password (min 6 characters)"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      User can change this password after first login
                    </p>
                  </div>
                  {canManageRoles && (
                    <div>
                      <Label htmlFor="add_role">Role</Label>
                      <Select value={formData.role} onValueChange={(value: Role) => setFormData(prev => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ROLES.TENANT_ADMIN}>{ROLE_LABELS.tenant_admin}</SelectItem>
                          <SelectItem value={ROLES.MANAGER}>{ROLE_LABELS.manager}</SelectItem>
                          <SelectItem value={ROLES.STAFF}>{ROLE_LABELS.staff}</SelectItem>
                          <SelectItem value={ROLES.VIEWER}>{ROLE_LABELS.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {showTenantPackageSelector && (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-4">
                      <Label htmlFor="add_tenant_package">Tenant Package</Label>
                      <Select
                        value={selectedTenantPackage}
                        onValueChange={(value: BillingPlanKey) => setSelectedTenantPackage(value)}
                      >
                        <SelectTrigger id="add_tenant_package">
                          <SelectValue />
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
                      <p className="text-xs text-muted-foreground">
                        This is a tenant-level package. Any change here will apply to the selected tenant when the user is created.
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/70 px-2 py-1">
                          {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.products, "products")}
                        </span>
                        <span className="rounded-full border border-border/70 px-2 py-1">
                          {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.customers, "customers")}
                        </span>
                        <span className="rounded-full border border-border/70 px-2 py-1">
                          {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.sales, "sales")}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleCreateUser}
                    disabled={createUserMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!hasTenantContext ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                {tenantIdOverride === undefined
                  ? "No active tenant found"
                  : "Select a tenant to manage users and permissions"}
              </p>
            </div>
          ) : error && (
            <div className="text-center py-8">
              <p className="text-error mb-2">Error loading users: {error.message}</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}>
                Retry
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No users found</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}>
                Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="md:hidden rounded-2xl border border-border/70 bg-background/30 p-3">
                <div className="space-y-3">
                  {users?.map((user) => {
                    const roleKey = String(user.role || "").toLowerCase();
                    const RoleIcon = roleIcons[roleKey] ?? User;
                    const roleVariant = roleColors[roleKey] ?? "secondary";
                    const roleLabel = ROLE_LABELS[user.role] ?? user.role;

                    return (
                      <div key={user.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{user.full_name}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                          <Badge
                            variant={roleVariant}
                            className="mt-2 inline-flex w-fit max-w-full items-center gap-1 text-[11px] leading-tight"
                          >
                            <RoleIcon className="h-3 w-3 shrink-0" />
                            <span className="whitespace-normal break-words">{roleLabel}</span>
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="justify-self-end text-right">{user.phone || "-"}</span>
                          <span className="text-muted-foreground">Joined</span>
                          <span className="justify-self-end text-right">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-muted-foreground">Last Active</span>
                          <span className="justify-self-end text-right">
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/users/${user.id}`} aria-label={`View profile for ${user.full_name}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.full_name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => {
                      const roleKey = String(user.role || "").toLowerCase();
                      const RoleIcon = roleIcons[roleKey] ?? User;
                      const roleVariant = roleColors[roleKey] ?? "secondary";
                      const roleLabel = ROLE_LABELS[user.role] ?? user.role;
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={roleVariant} className="flex items-center gap-1 w-fit">
                              <RoleIcon className="h-3 w-3" />
                              {roleLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleDateString()
                              : "Never"
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link to={`/users/${user.id}`} aria-label={`View profile for ${user.full_name}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {user.full_name}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {canManagePermissions && hasTenantContext && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>User Role Permission Management</CardTitle>
              <CardDescription>Control which features each role can access</CardDescription>
            </div>
            <div className="w-full sm:w-64">
              <Label className="sr-only">Role</Label>
              <Select value={selectedRole} onValueChange={(v: EditablePermissionRoleWithAdmin) => setSelectedRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {permissionRoleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto p-1 gap-1">
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="general">General</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="products_inventory">Products & Inventory</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="sales_invoices">Sales & Invoices</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="customers">Customers</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="hr_management">HR Management</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="reports">Reports & Analytics</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="settings">Settings</TabsTrigger>
                <TabsTrigger className="text-xs sm:text-sm px-2 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="administration">Administration</TabsTrigger>
              </TabsList>

              {PERMISSION_TABS.map((tabKey) => (
                <TabsContent key={tabKey} value={tabKey} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Select all in this tab</div>
                    <Switch checked={allInTabOn} onCheckedChange={(v) => setAllInTab(!!v)} disabled={permsLoading || savePermissionsMutation.isPending} />
                  </div>
                  <div className="divide-y rounded-md border">
                    {PERMISSIONS[tabKey].map((p) => (
                      <div key={p.key} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="font-medium cursor-help">{p.label}</div>
                              </TooltipTrigger>
                              <TooltipContent>{p.description}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch checked={!!toggles[p.key]} onCheckedChange={() => togglePermission(p.key)} disabled={permsLoading || savePermissionsMutation.isPending} />
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end">
              <Button onClick={() => savePermissionsMutation.mutate()} disabled={savePermissionsMutation.isPending}>
                {savePermissionsMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Full Name *</Label>
              <Input
                id="edit_full_name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit_email">Email Address *</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">Phone Number</Label>
              <Input
                id="edit_phone"
                placeholder="+1234567890"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit_password">New Password (optional)</Label>
              <PasswordInput
                id="edit_password"
                placeholder="Leave blank to keep current password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only fill this if you want to change the user's password
              </p>
            </div>
            {canManageRoles && (
              <div>
                <Label htmlFor="edit_role">Role</Label>
                <Select value={formData.role} onValueChange={(value: Role) => setFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLES.TENANT_ADMIN}>{ROLE_LABELS.tenant_admin}</SelectItem>
                    <SelectItem value={ROLES.MANAGER}>{ROLE_LABELS.manager}</SelectItem>
                    <SelectItem value={ROLES.STAFF}>{ROLE_LABELS.staff}</SelectItem>
                    <SelectItem value={ROLES.VIEWER}>{ROLE_LABELS.viewer}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showTenantPackageSelector && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-4">
                <Label htmlFor="edit_tenant_package">Tenant Package</Label>
                <Select
                  value={selectedTenantPackage}
                  onValueChange={(value: BillingPlanKey) => setSelectedTenantPackage(value)}
                >
                  <SelectTrigger id="edit_tenant_package">
                    <SelectValue />
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
                <p className="text-xs text-muted-foreground">
                  This is a tenant-level package. Any change here will apply to the selected tenant when the user update is saved.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/70 px-2 py-1">
                    {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.products, "products")}
                  </span>
                  <span className="rounded-full border border-border/70 px-2 py-1">
                    {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.customers, "customers")}
                  </span>
                  <span className="rounded-full border border-border/70 px-2 py-1">
                    {formatPackageLimit(selectedTenantPackageDefinition.usageLimits.sales, "sales")}
                  </span>
                </div>
              </div>
            )}
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              className="w-full"
            >
              <Edit className="h-4 w-4 mr-2" />
              {updateUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
