import { Injectable, NotFoundException } from "@nestjs/common";

import { PlatformDbService } from "../../infra/database/platform-db.service";

export interface TenantMetricsRow {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  company_name: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_phone: string | null;
  welcome_email_status: string | null;
  welcome_email_sent_at: string | null;
  welcome_email_error: string | null;
  welcome_email_error_code: string | null;
  customers_count: number;
  daily_transaction_amount: number;
  daily_order_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantDetailRow extends TenantMetricsRow {
  products_count: number;
  total_order_quantity: number;
  total_transaction_amount: number;
}

interface TenantActivityRow {
  date: string;
  order_count: number;
  transaction_amount: number;
}

const toNumber = (value: unknown) => Number(value ?? 0);

@Injectable()
export class PlatformSuperAdminService {
  private readonly publicColumnCache = new Map<string, boolean>();

  constructor(private readonly platformDb: PlatformDbService) {}

  private async hasPublicColumn(tableName: string, columnName: string): Promise<boolean> {
    const cacheKey = `${tableName}.${columnName}`;
    const cached = this.publicColumnCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const row = await this.platformDb.queryOne<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists
      `,
      [tableName, columnName],
    );

    const exists = Boolean(row?.exists);
    this.publicColumnCache.set(cacheKey, exists);
    return exists;
  }

  async getOverview() {
    const customersVisibilityFilter = (await this.hasPublicColumn("customers", "is_deleted"))
      ? "WHERE COALESCE(is_deleted, false) = false"
      : "";

    const overviewRow = await this.platformDb.queryOne<{
      tenants_total: number;
      tenants_active: number;
      tenants_inactive: number;
      customer_count: number;
      today_order_count: number;
      today_transaction_amount: number;
      pending_request_count: number;
      failed_notification_count: number;
    }>(
      `
        WITH dhaka_today AS (
          SELECT (timezone('Asia/Dhaka', now()))::date AS current_day
        )
        SELECT
          (SELECT COUNT(*)::int FROM tenants) AS tenants_total,
          (SELECT COUNT(*)::int FROM tenants WHERE is_active = true) AS tenants_active,
          (SELECT COUNT(*)::int FROM tenants WHERE is_active = false) AS tenants_inactive,
          (SELECT COUNT(*)::int FROM customers ${customersVisibilityFilter}) AS customer_count,
          (
            SELECT COUNT(*)::int
            FROM sales s
            CROSS JOIN dhaka_today t
            WHERE (timezone('Asia/Dhaka', s.created_at))::date = t.current_day
          ) AS today_order_count,
          (
            SELECT COALESCE(SUM(GREATEST(0, COALESCE(s.grand_total, 0) - COALESCE(s.fee, 0))), 0)::double precision
            FROM sales s
            CROSS JOIN dhaka_today t
            WHERE (timezone('Asia/Dhaka', s.created_at))::date = t.current_day
          ) AS today_transaction_amount,
          (
            SELECT COUNT(*)::int
            FROM demo_requests dr
            WHERE dr.status = 'pending'
          ) AS pending_request_count,
          (
            SELECT COUNT(*)::int
            FROM demo_requests dr
            WHERE dr.request_notification_status IN ('failed', 'skipped')
          ) AS failed_notification_count
      `,
    );

    const normalizedRow = {
      tenants_total: toNumber(overviewRow?.tenants_total),
      tenants_active: toNumber(overviewRow?.tenants_active),
      tenants_inactive: toNumber(overviewRow?.tenants_inactive),
      customer_count: toNumber(overviewRow?.customer_count),
      today_order_count: toNumber(overviewRow?.today_order_count),
      today_transaction_amount: toNumber(overviewRow?.today_transaction_amount),
      pending_request_count: toNumber(overviewRow?.pending_request_count),
      failed_notification_count: toNumber(overviewRow?.failed_notification_count),
    };

    return {
      generated_at: new Date().toISOString(),
      totals: normalizedRow,
    };
  }

  async listTenantMetrics(): Promise<TenantMetricsRow[]> {
    const customersVisibilityFilter = (await this.hasPublicColumn("customers", "is_deleted"))
      ? "WHERE COALESCE(c.is_deleted, false) = false"
      : "";

    const rows = await this.platformDb.query<TenantMetricsRow>(
      `
        WITH dhaka_today AS (
          SELECT (timezone('Asia/Dhaka', now()))::date AS current_day
        ),
        customer_counts AS (
          SELECT
            c.tenant_id,
            COUNT(*)::int AS customers_count
          FROM customers c
          ${customersVisibilityFilter}
          GROUP BY c.tenant_id
        ),
        daily_sales AS (
          SELECT
            s.tenant_id,
            COUNT(*)::int AS daily_order_quantity,
            COALESCE(SUM(GREATEST(0, COALESCE(s.grand_total, 0) - COALESCE(s.fee, 0))), 0)::double precision AS daily_transaction_amount
          FROM sales s
          CROSS JOIN dhaka_today t
          WHERE (timezone('Asia/Dhaka', s.created_at))::date = t.current_day
          GROUP BY s.tenant_id
        )
        SELECT
          t.id AS tenant_id,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          COALESCE(bs.business_name, t.name) AS company_name,
          admin.admin_name AS admin_name,
          admin.admin_email AS admin_email,
          admin.admin_phone AS admin_phone,
          t.welcome_email_status AS welcome_email_status,
          t.welcome_email_sent_at::text AS welcome_email_sent_at,
          t.welcome_email_error AS welcome_email_error,
          t.welcome_email_error_code AS welcome_email_error_code,
          COALESCE(cc.customers_count, 0)::int AS customers_count,
          COALESCE(ds.daily_transaction_amount, 0)::double precision AS daily_transaction_amount,
          COALESCE(ds.daily_order_quantity, 0)::int AS daily_order_quantity,
          t.is_active,
          t.created_at::text AS created_at,
          t.updated_at::text AS updated_at
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT business_name
          FROM business_settings
          WHERE tenant_id = t.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) bs ON true
        LEFT JOIN LATERAL (
          SELECT
            p.full_name AS admin_name,
            p.email AS admin_email,
            p.phone AS admin_phone
          FROM tenant_members m
          LEFT JOIN profiles p ON p.id = m.user_id
          WHERE m.tenant_id = t.id
            AND COALESCE(m.is_active, true) = true
          ORDER BY
            CASE
              WHEN lower(m.role) IN ('tenant_admin', 'tenant admin', 'owner') THEN 0
              WHEN lower(m.role) = 'admin' THEN 1
              ELSE 2
            END,
            COALESCE(m.is_default, false) DESC,
            m.created_at DESC
          LIMIT 1
        ) admin ON true
        LEFT JOIN customer_counts cc ON cc.tenant_id = t.id
        LEFT JOIN daily_sales ds ON ds.tenant_id = t.id
        ORDER BY t.created_at DESC
      `,
    );

    return rows.map((row) => ({
      ...row,
      customers_count: toNumber(row.customers_count),
      daily_transaction_amount: toNumber(row.daily_transaction_amount),
      daily_order_quantity: toNumber(row.daily_order_quantity),
    }));
  }

  async getTenantDetail(tenantId: string) {
    const customersVisibilityFilter = (await this.hasPublicColumn("customers", "is_deleted"))
      ? "WHERE COALESCE(c.is_deleted, false) = false"
      : "";
    const productsVisibilityFilter = (await this.hasPublicColumn("products", "is_deleted"))
      ? "WHERE COALESCE(p.is_deleted, false) = false"
      : "";
    const salesVisibilityConditions: string[] = [];
    if (await this.hasPublicColumn("sales", "is_deleted")) {
      salesVisibilityConditions.push("COALESCE(s.is_deleted, false) = false");
    }
    if (await this.hasPublicColumn("sales", "payment_status")) {
      salesVisibilityConditions.push("COALESCE(s.payment_status, '') <> 'cancelled'");
    }
    const salesVisibilityClause = salesVisibilityConditions.length
      ? `AND ${salesVisibilityConditions.join(" AND ")}`
      : "";
    const salesVisibilityWhere = salesVisibilityConditions.length
      ? `WHERE ${salesVisibilityConditions.join(" AND ")}`
      : "";

    const tenantRow = await this.platformDb.queryOne<TenantDetailRow>(
      `
        WITH dhaka_today AS (
          SELECT (timezone('Asia/Dhaka', now()))::date AS current_day
        ),
        customer_counts AS (
          SELECT
            c.tenant_id,
            COUNT(*)::int AS customers_count
          FROM customers c
          ${customersVisibilityFilter}
          GROUP BY c.tenant_id
        ),
        daily_sales AS (
          SELECT
            s.tenant_id,
            COUNT(*)::int AS daily_order_quantity,
            COALESCE(SUM(GREATEST(0, COALESCE(s.grand_total, 0) - COALESCE(s.fee, 0))), 0)::double precision AS daily_transaction_amount
          FROM sales s
          CROSS JOIN dhaka_today t
          WHERE (timezone('Asia/Dhaka', s.created_at))::date = t.current_day
          ${salesVisibilityClause}
          GROUP BY s.tenant_id
        ),
        product_counts AS (
          SELECT
            p.tenant_id,
            COUNT(*)::int AS products_count
          FROM products p
          ${productsVisibilityFilter}
          GROUP BY p.tenant_id
        ),
        total_sales AS (
          SELECT
            s.tenant_id,
            COUNT(*)::int AS total_order_quantity,
            COALESCE(SUM(GREATEST(0, COALESCE(s.grand_total, 0) - COALESCE(s.fee, 0))), 0)::double precision AS total_transaction_amount
          FROM sales s
          ${salesVisibilityWhere}
          GROUP BY s.tenant_id
        )
        SELECT
          t.id AS tenant_id,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          COALESCE(bs.business_name, t.name) AS company_name,
          admin.admin_name AS admin_name,
          admin.admin_email AS admin_email,
          admin.admin_phone AS admin_phone,
          t.welcome_email_status AS welcome_email_status,
          t.welcome_email_sent_at::text AS welcome_email_sent_at,
          t.welcome_email_error AS welcome_email_error,
          t.welcome_email_error_code AS welcome_email_error_code,
          COALESCE(cc.customers_count, 0)::int AS customers_count,
          COALESCE(ds.daily_transaction_amount, 0)::double precision AS daily_transaction_amount,
          COALESCE(ds.daily_order_quantity, 0)::int AS daily_order_quantity,
          COALESCE(pc.products_count, 0)::int AS products_count,
          COALESCE(ts.total_order_quantity, 0)::int AS total_order_quantity,
          COALESCE(ts.total_transaction_amount, 0)::double precision AS total_transaction_amount,
          t.is_active,
          t.created_at::text AS created_at,
          t.updated_at::text AS updated_at
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT business_name
          FROM business_settings
          WHERE tenant_id = t.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) bs ON true
        LEFT JOIN LATERAL (
          SELECT
            p.full_name AS admin_name,
            p.email AS admin_email,
            p.phone AS admin_phone
          FROM tenant_members m
          LEFT JOIN profiles p ON p.id = m.user_id
          WHERE m.tenant_id = t.id
            AND COALESCE(m.is_active, true) = true
          ORDER BY
            CASE
              WHEN lower(m.role) IN ('tenant_admin', 'tenant admin', 'owner') THEN 0
              WHEN lower(m.role) = 'admin' THEN 1
              ELSE 2
            END,
            COALESCE(m.is_default, false) DESC,
            m.created_at DESC
          LIMIT 1
        ) admin ON true
        LEFT JOIN customer_counts cc ON cc.tenant_id = t.id
        LEFT JOIN daily_sales ds ON ds.tenant_id = t.id
        LEFT JOIN product_counts pc ON pc.tenant_id = t.id
        LEFT JOIN total_sales ts ON ts.tenant_id = t.id
        WHERE t.id = $1
        LIMIT 1
      `,
      [tenantId],
    );

    if (!tenantRow) {
      throw new NotFoundException("Tenant not found");
    }

    const activityRows = await this.platformDb.query<TenantActivityRow>(
      `
        WITH days AS (
          SELECT ((timezone('Asia/Dhaka', now()))::date - gs)::date AS day
          FROM generate_series(0, 6) AS gs
        ),
        daily AS (
          SELECT
            (timezone('Asia/Dhaka', s.created_at))::date AS sale_day,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(GREATEST(0, COALESCE(s.grand_total, 0) - COALESCE(s.fee, 0))), 0)::double precision AS transaction_amount
          FROM sales s
          WHERE s.tenant_id = $1
            AND (timezone('Asia/Dhaka', s.created_at))::date >= ((timezone('Asia/Dhaka', now()))::date - 6)
          GROUP BY sale_day
        )
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS date,
          COALESCE(daily.order_count, 0)::int AS order_count,
          COALESCE(daily.transaction_amount, 0)::double precision AS transaction_amount
        FROM days
        LEFT JOIN daily ON daily.sale_day = days.day
        ORDER BY days.day DESC
      `,
      [tenantId],
    );

    const normalizedActivity = activityRows.map((row) => ({
      date: row.date,
      order_count: toNumber(row.order_count),
      transaction_amount: toNumber(row.transaction_amount),
    }));

    return {
      ...tenantRow,
      customers_count: toNumber(tenantRow.customers_count),
      daily_transaction_amount: toNumber(tenantRow.daily_transaction_amount),
      daily_order_quantity: toNumber(tenantRow.daily_order_quantity),
      products_count: toNumber(tenantRow.products_count),
      total_order_quantity: toNumber(tenantRow.total_order_quantity),
      total_transaction_amount: toNumber(tenantRow.total_transaction_amount),
      week_order_quantity: normalizedActivity.reduce((sum, row) => sum + row.order_count, 0),
      week_transaction_amount: normalizedActivity.reduce((sum, row) => sum + row.transaction_amount, 0),
      recent_activity: normalizedActivity,
    };
  }
}
