import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { PlatformDbService } from "../../infra/database/platform-db.service";

interface CustomerWriteData {
  name?: string;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  tags?: string[];
  status?: string;
  additional_info?: string | null;
  credit_limit?: number;
}

export interface CustomerUpsertPayload {
  id?: string;
  data?: CustomerWriteData;
}

interface MembershipRow {
  tenant_id: string;
  role: string | null;
}

interface RoleRow {
  role: string | null;
}

interface RolePermissionRow {
  allowed: boolean;
}

interface CustomerRow {
  id: string;
  tenant_id: string;
}

const CUSTOMER_MUTABLE_FIELDS = new Set([
  "name",
  "phone",
  "whatsapp",
  "address",
  "tags",
  "status",
  "additional_info",
  "credit_limit",
]);

@Injectable()
export class CustomersService {
  constructor(private readonly platformDb: PlatformDbService) {}

  private normalizeRole(role: string | null | undefined): string {
    const normalized = String(role ?? "").trim().toLowerCase();
    if (normalized === "super_admin") return "superadmin";
    if (normalized === "admin") return "tenant_admin";
    return normalized;
  }

  private mapMembershipRoleToAppRole(role: string | null | undefined): string {
    const normalized = this.normalizeRole(role);
    if (normalized === "owner" || normalized === "admin") return "tenant_admin";
    if (normalized === "manager") return "manager";
    if (normalized === "staff") return "staff";
    if (normalized === "member") return "viewer";
    return normalized;
  }

  private getPermissionRoleCandidates(role: string): string[] {
    if (role === "tenant_admin") return ["tenant_admin", "admin"];
    if (role === "store_manager") return ["manager"];
    if (role === "sales_associate" || role === "warehouse") return ["staff"];
    if (role === "member") return ["viewer"];
    return [role];
  }

  private hasDefaultPermission(role: string, permissionKey: string): boolean {
    if (role === "superadmin" || role === "tenant_admin" || role === "admin") {
      return true;
    }

    if (role === "manager") {
      return permissionKey === "customers.add" || permissionKey === "customers.edit";
    }

    if (role === "staff") {
      return permissionKey === "customers.add" || permissionKey === "customers.edit";
    }

    return false;
  }

  private isSchemaCompatibilityError(error: unknown): boolean {
    const message = String(error instanceof Error ? error.message : error ?? "");
    return /credit_limit|column.*does not exist|schema cache/i.test(message);
  }

  private async resolveMembership(userId: string): Promise<MembershipRow> {
    const membership = await this.platformDb.queryOne<MembershipRow>(
      `
        SELECT tenant_id, role
        FROM tenant_members
        WHERE user_id = $1
          AND is_active = true
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
      `,
      [userId],
    );

    if (!membership?.tenant_id) {
      throw new UnauthorizedException("No active tenant membership found");
    }

    return membership;
  }

  private async resolveActorContext(userId: string): Promise<{
    tenantId: string;
    appRole: string;
  }> {
    const membership = await this.resolveMembership(userId);

    const [userRole, profileRole] = await Promise.all([
      this.platformDb.queryOne<RoleRow>(
        `
          SELECT role::text AS role
          FROM user_roles
          WHERE user_id = $1
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [userId],
      ),
      this.platformDb.queryOne<RoleRow>(
        `
          SELECT role::text AS role
          FROM profiles
          WHERE id = $1
          LIMIT 1
        `,
        [userId],
      ),
    ]);

    return {
      tenantId: membership.tenant_id,
      appRole:
        this.normalizeRole(userRole?.role) === "superadmin"
          ? "superadmin"
          : this.normalizeRole(profileRole?.role) === "superadmin"
            ? "superadmin"
            : this.mapMembershipRoleToAppRole(membership.role) ||
              this.normalizeRole(userRole?.role) ||
              this.normalizeRole(profileRole?.role),
    };
  }

  private async resolvePermission(
    tenantId: string,
    roleCandidates: string[],
    permissionKey: string,
  ): Promise<boolean | null> {
    const tenantPermission = await this.platformDb.queryOne<RolePermissionRow>(
      `
        SELECT allowed
        FROM tenant_role_permissions
        WHERE tenant_id = $1
          AND role::text = ANY($2)
          AND permission_key = $3
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      [tenantId, roleCandidates, permissionKey],
    );

    if (tenantPermission) {
      return Boolean(tenantPermission.allowed);
    }

    const globalPermission = await this.platformDb.queryOne<RolePermissionRow>(
      `
        SELECT allowed
        FROM role_permissions
        WHERE role::text = ANY($1)
          AND permission_key = $2
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      [roleCandidates, permissionKey],
    );

    if (globalPermission) {
      return Boolean(globalPermission.allowed);
    }

    return null;
  }

  private async ensurePermission(tenantId: string, role: string, permissionKey: string) {
    if (role === "superadmin" || role === "admin" || role === "tenant_admin") {
      return;
    }

    const permission = await this.resolvePermission(
      tenantId,
      this.getPermissionRoleCandidates(role),
      permissionKey,
    );

    if (permission === true || this.hasDefaultPermission(role, permissionKey)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permissionKey}`);
  }

  private buildParameterizedUpdate(
    data: CustomerWriteData,
    offset = 3,
  ): { sql: string; params: unknown[] } {
    const entries = Object.entries(data).filter(
      ([key, value]) => CUSTOMER_MUTABLE_FIELDS.has(key) && value !== undefined,
    );
    const assignments = entries.map(([key], index) => `${key} = $${offset + index}`);
    const params = entries.map(([, value]) => value);
    return {
      sql: assignments.join(", "),
      params,
    };
  }

  async upsertCustomer(input: { userId: string; payload: CustomerUpsertPayload }) {
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    const actorContext = await this.resolveActorContext(userId);
    const payload = input.payload ?? {};
    const customerData = payload.data ?? {};
    const customerId = String(payload.id ?? "").trim() || null;

    if (customerId) {
      await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "customers.edit");
    } else {
      await this.ensurePermission(actorContext.tenantId, actorContext.appRole, "customers.add");
    }

    if (!customerId && !String(customerData.name ?? "").trim()) {
      throw new ForbiddenException("Customer name is required");
    }

    if (customerId) {
      const existing = await this.platformDb.queryOne<CustomerRow>(
        `
          SELECT id, tenant_id
          FROM customers
          WHERE id = $1
            AND tenant_id = $2
          LIMIT 1
        `,
        [customerId, actorContext.tenantId],
      );

      if (!existing) {
        throw new NotFoundException("Customer not found in your tenant");
      }

      const normalizedData: CustomerWriteData = {
        ...customerData,
        name:
          customerData.name !== undefined
            ? String(customerData.name).trim()
            : undefined,
      };

      let update = this.buildParameterizedUpdate(normalizedData);
      if (update.sql) {
        try {
          await this.platformDb.query(
            `
              UPDATE customers
              SET ${update.sql}, updated_at = now()
              WHERE id = $1
                AND tenant_id = $2
            `,
            [customerId, actorContext.tenantId, ...update.params],
          );
        } catch (error) {
          if (!this.isSchemaCompatibilityError(error) || !("credit_limit" in normalizedData)) {
            throw error;
          }

          const { credit_limit, ...fallbackData } = normalizedData;
          update = this.buildParameterizedUpdate(fallbackData);
          if (update.sql) {
            await this.platformDb.query(
              `
                UPDATE customers
                SET ${update.sql}, updated_at = now()
                WHERE id = $1
                  AND tenant_id = $2
              `,
              [customerId, actorContext.tenantId, ...update.params],
            );
          }
        }
      }

      const salesUpdateMap: Record<string, string> = {
        name: "customer_name",
        phone: "customer_phone",
        whatsapp: "customer_whatsapp",
        address: "customer_address",
        additional_info: "additional_info",
      };

      const salesEntries = Object.entries(
        {
          name: normalizedData.name,
          phone: normalizedData.phone,
          whatsapp: normalizedData.whatsapp,
          address: normalizedData.address,
          additional_info: normalizedData.additional_info,
        },
      ).filter(([, value]) => value !== undefined);

      if (salesEntries.length > 0) {
        const salesSql = salesEntries
          .map(([key], index) => `${salesUpdateMap[key]} = $${3 + index}`)
          .join(", ");
        const salesParams = salesEntries.map(([, value]) => value);

        await this.platformDb.query(
          `
            UPDATE sales
            SET ${salesSql}, updated_at = now()
            WHERE customer_id = $1
              AND tenant_id = $2
          `,
          [customerId, actorContext.tenantId, ...salesParams],
        );
      }

      const updated = await this.platformDb.queryOne<{ id: string; name: string }>(
        `
          SELECT id, name
          FROM customers
          WHERE id = $1
            AND tenant_id = $2
          LIMIT 1
        `,
        [customerId, actorContext.tenantId],
      );

      if (!updated) {
        throw new NotFoundException("Updated customer not found");
      }

      return updated;
    }

    let created: { id: string; name: string } | null = null;
    try {
      created = await this.platformDb.queryOne<{ id: string; name: string }>(
        `
          INSERT INTO customers (
            name,
            phone,
            whatsapp,
            address,
            tags,
            status,
            additional_info,
            credit_limit,
            created_by,
            tenant_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, name
        `,
        [
          String(customerData.name ?? "").trim(),
          customerData.phone ?? null,
          customerData.whatsapp ?? null,
          customerData.address ?? null,
          customerData.tags ?? [],
          customerData.status ?? "inactive",
          customerData.additional_info ?? null,
          customerData.credit_limit ?? 0,
          userId,
          actorContext.tenantId,
        ],
      );
    } catch (error) {
      if (!this.isSchemaCompatibilityError(error)) {
        throw error;
      }

      created = await this.platformDb.queryOne<{ id: string; name: string }>(
        `
          INSERT INTO customers (
            name,
            phone,
            whatsapp,
            address,
            tags,
            status,
            additional_info,
            created_by,
            tenant_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, name
        `,
        [
          String(customerData.name ?? "").trim(),
          customerData.phone ?? null,
          customerData.whatsapp ?? null,
          customerData.address ?? null,
          customerData.tags ?? [],
          customerData.status ?? "inactive",
          customerData.additional_info ?? null,
          userId,
          actorContext.tenantId,
        ],
      );
    }

    if (!created) {
      throw new ForbiddenException("Customer insert failed");
    }

    return created;
  }
}
