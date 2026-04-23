import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PlatformDbService } from "../../infra/database/platform-db.service";
import { ROLES_KEY } from "../decorators/roles.decorator";

const normalizeRole = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");

const roleAliases: Record<string, string> = {
  super_admin: "superadmin",
  tenant_admin: "tenant_admin",
  admin: "tenant_admin",
};

const normalizeToCanonicalRole = (value: unknown) => {
  const normalized = normalizeRole(value);
  return roleAliases[normalized] ?? normalized;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformDb: PlatformDbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | {
          id?: string;
          app_metadata?: Record<string, unknown>;
          user_metadata?: Record<string, unknown>;
        }
      | undefined;
    const userId = String(request.userId ?? user?.id ?? "");
    const appMetadata = user?.app_metadata ?? {};
    const userMetadata = user?.user_metadata ?? {};
    const appMetadataRoles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    const userMetadataRoles = Array.isArray(userMetadata.roles) ? userMetadata.roles : [];

    const required = new Set(requiredRoles.map((role) => normalizeToCanonicalRole(role)));
    const metadataRoles = [
      appMetadata.role,
      userMetadata.role,
      ...appMetadataRoles,
      ...userMetadataRoles,
    ]
      .map((role) => normalizeToCanonicalRole(role))
      .filter(Boolean);

    const hasMetadataRole = metadataRoles.some((role) => required.has(role));
    if (hasMetadataRole) {
      return true;
    }

    if (!userId) {
      throw new ForbiddenException("Role check failed");
    }

    const [userRole, profileRole] = await Promise.all([
      this.platformDb.queryOne<{ role: string }>(
        `
          SELECT role
          FROM user_roles
          WHERE user_id = $1
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [userId],
      ),
      this.platformDb.queryOne<{ role: string }>(
        `
          SELECT role
          FROM profiles
          WHERE id = $1
          LIMIT 1
        `,
        [userId],
      ),
    ]);

    const resolvedDbRole =
      normalizeToCanonicalRole(userRole?.role) || normalizeToCanonicalRole(profileRole?.role);
    if (resolvedDbRole && required.has(resolvedDbRole)) {
      return true;
    }

    throw new ForbiddenException("Insufficient role");
  }
}
