export const ROLES = {
  SUPERADMIN: "superadmin",
  TENANT_ADMIN: "tenant_admin",
  MANAGER: "manager",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  superadmin: 100,
  tenant_admin: 80,
  manager: 60,
  staff: 40,
  viewer: 20,
};

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Admin",
  tenant_admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_ALIASES: Record<string, Role> = {
  admin: "tenant_admin",
  owner: "tenant_admin",
  store_manager: "manager",
  sales_associate: "staff",
  warehouse: "staff",
  member: "viewer",
};

const ROLE_VALUES = new Set<Role>(Object.values(ROLES));

export const isRole = (value: string): value is Role => {
  return ROLE_VALUES.has(value as Role);
};

export const normalizeRole = (value: string | null | undefined): Role | null => {
  if (!value) return null;
  if (isRole(value)) return value;
  return ROLE_ALIASES[value] ?? null;
};

export const getRoleCandidates = (role: Role | null): string[] => {
  if (!role) return [];
  const aliases = Object.entries(ROLE_ALIASES)
    .filter(([, mapped]) => mapped === role)
    .map(([alias]) => alias);
  return [role, ...aliases];
};

export const hasMinimumRole = (
  role: Role | null | undefined,
  minimumRole: Role,
): boolean => {
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
};
