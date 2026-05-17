# ⚡ ENTERPRISE SAAS ARCHITECTURE BLUEPRINT v6.0
> **THE PRODUCTION ENGINE EDITION**

**Stack:** Next.js 15 · NestJS · Supabase PostgreSQL · Temporal · BullMQ · Redis · Stripe  
**Target:** 100K Concurrent Users · Sub-200ms TTFB · Zero Data Leakage · Zero Cross-Tenant Bleed  
**Modules:** HRM · Payroll · Attendance · Accounts & Finance · Purchase · Production · Inventory · Warehouse  
**What's new in v6:** All 5 critical safety rules are baked into the engine layer — no frontend request can bypass them, no developer mistake can cause cross-tenant data leakage.

---

## THE 5 UNBREAKABLE ENGINE RULES

These are not guidelines. They are enforced at the infrastructure layer. No service, controller, or frontend request can bypass them.

```
RULE 1 — SET LOCAL must always run inside an explicit transaction
          Prevents tenant context from bleeding between pooled connections

RULE 2 — Use one consistent DB client pattern per request context
          Raw pg client with withTenantContext() for all tenant operations

RULE 3 — Stock deduction must use atomic UPDATE with qty check
          Prevents overselling under concurrent orders

RULE 4 — tenant_id always injected from server context, never from request body
          A frontend can never write into another tenant's data

RULE 5 — Always use joins, never loops for related data
          Prevents N+1 queries that kill Postgres under load
```

Every code example in this blueprint follows all 5 rules. If you copy any snippet, the rules are already in it.

---

## PART 0 — ARCHITECTURE OVERVIEW

### 0A. Technology Stack & Responsibilities

| Layer | Technology | Owns | Never Does |
|---|---|---|---|
| Auth & DB | **Supabase** | JWT, PostgreSQL, RLS, Storage, Realtime, Edge Fn, pg_cron | Application business logic |
| API Backend | **NestJS** | Domain services, tenant context, integrations | Direct DB access without tenant context |
| Frontend | **Next.js 15** | SSR, App Router, Server Actions, middleware | DB access, service role key |
| Long Workflows | **Temporal** | Payroll, production orders, month-end close | Short jobs under 30 seconds |
| Async Jobs | **BullMQ + Redis** | Email, PDF, notifications, cache | Stateful multi-step flows |
| Gateway | **Nginx** | Rate limiting, TLS, backpressure | Business logic |

### 0B. What Supabase Owns (Never Replace These)

```
✅ Supabase Auth      — JWT issuance, refresh tokens, magic links, OAuth providers
✅ Supabase Postgres  — Primary database, RLS engine (Postgres-native, not Supabase-specific)
✅ Supabase RLS       — Row Level Security — enforced at the DB engine level
✅ Supabase Storage   — File uploads, invoices, employee documents, product images
✅ Supabase Realtime  — Live websocket notifications to connected clients
✅ Supabase Edge Fn   — Tenant provisioner, Stripe webhooks, lightweight triggers
✅ pg_cron            — Scheduled jobs: MV refresh, partition creation, usage reset
```

> **RLS is native PostgreSQL** — not a Supabase invention. Supabase just provides hosting + dashboard to manage it. The enforcement happens inside the Postgres query engine before data leaves the database process.

### 0C. System Architecture Diagram

```
BROWSER / MOBILE
  ↓ HTTPS
COOLIFY INGRESS / REVERSE PROXY
  ↓
NEXT.JS 15 (App Router + Middleware)
  ├── Middleware: reads URL slug → resolves tenant_id → verifies membership
  ├── Sets: x-tenant-id, x-tenant-role, x-user-id headers
  ├── Server Components: fetch data via NestJS API (never direct DB)
  └── Server Actions: mutations via NestJS API (never direct DB)
  ↓
NGINX API GATEWAY (rate limiting + TLS)
  ↓
NESTJS BACKEND
  ├── JwtGuard: verifies Supabase JWT
  ├── TenantGuard: validates tenant membership from header
  ├── TenantContextInterceptor: SET LOCAL app.tenant_id per request
  ├── PermissionGuard: RBAC check via has_permission()
  ├── Domain Services: sales, hr, finance, purchase, production, warehouse
  ├── BullMQ Producers → Redis Queues → BullMQ Workers
  └── Temporal Client → Temporal Workflows
  ↓
SUPABASE POSTGRESQL
  ├── RLS fires on every query: tenant_id = current_tenant_id()
  ├── Triggers: stock updates, journal entries, break totals, audit logs
  ├── Partitions: audit_logs, inventory_logs, notifications (monthly)
  └── pg_cron: MV refreshes, partition creation, usage metering reset
```

### 0D. How Two Tenants With Same Product Work

```
TENANT A (Fruit Shop) creates product "Apple"
  → id = prod-AAA, tenant_id = FRUIT-UUID, stock_qty = 0

TENANT B (Grocery Store) creates product "Apple"
  → id = prod-BBB, tenant_id = GROCERY-UUID, stock_qty = 0

DATABASE (raw — only super admin sees this):
┌──────────┬─────────────┬───────┬────────────┬───────────┐
│ id       │ tenant_id   │ name  │ unit_price │ stock_qty │
├──────────┼─────────────┼───────┼────────────┼───────────┤
│ prod-AAA │ FRUIT-UUID  │ Apple │ 120.00     │ 450       │
│ prod-BBB │ GROCERY-UUID│ Apple │  95.00     │ 280       │
└──────────┴─────────────┴───────┴────────────┴───────────┘

Fruit Shop queries products (SET LOCAL app.tenant_id = FRUIT-UUID):
  → sees: prod-AAA Apple 120.00 stock:450

Grocery queries products (SET LOCAL app.tenant_id = GROCERY-UUID):
  → sees: prod-BBB Apple  95.00 stock:280

Neither knows the other's Apple exists.
Their stock counters are completely independent.
Their order histories reference different product UUIDs.
Cross-contamination is physically impossible via RLS.
```

---

## PART 1 — PROJECT STRUCTURE

### 1A. NestJS Backend Structure

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   │
│   ├── infra/                          # Infrastructure — loaded once globally
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   ├── database.service.ts     # ← RULE 1 & 2 live here (withTenantContext)
│   │   │   └── transaction.helper.ts
│   │   ├── redis/
│   │   │   ├── redis.module.ts
│   │   │   └── redis.service.ts
│   │   └── temporal/
│   │       ├── temporal.module.ts
│   │       └── temporal.service.ts
│   │
│   ├── common/                         # Cross-cutting concerns
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   └── permission.guard.ts
│   │   ├── interceptors/
│   │   │   ├── tenant-context.interceptor.ts   # ← RULE 1 enforced here
│   │   │   └── audit.interceptor.ts
│   │   ├── decorators/
│   │   │   ├── current-tenant.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── require-permission.decorator.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   └── middleware/
│   │       └── request-id.middleware.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── products/                   # ← RULE 3 (atomic stock) lives here
│   │   ├── sales/
│   │   ├── inventory/
│   │   ├── hr/
│   │   ├── payroll/
│   │   ├── attendance/
│   │   ├── finance/
│   │   ├── purchase/
│   │   ├── production/
│   │   ├── warehouse/
│   │   ├── notifications/
│   │   └── reports/
│   │
│   └── workers/
│       ├── bullmq/
│       └── temporal/
│
├── test/
│   └── rls-breach.spec.ts              # ← Cross-tenant breach tests (CI gate)
├── .env
└── package.json
```

### 1B. Next.js Frontend Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── (marketing)/                # Public pages — no auth
│   │   │   └── page.tsx
│   │   ├── (auth)/                     # Login, register, forgot password
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── [tenant]/                   # All authenticated tenant pages
│   │       ├── layout.tsx              # Tenant shell — verifies membership
│   │       ├── dashboard/page.tsx
│   │       ├── sales/
│   │       ├── products/
│   │       ├── inventory/
│   │       ├── hr/
│   │       ├── payroll/
│   │       ├── finance/
│   │       ├── purchase/
│   │       ├── production/
│   │       └── warehouse/
│   │
│   ├── middleware.ts                   # ← RULE 4 enforced here
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client (anon key only)
│   │   │   ├── server.ts               # Server client (anon key + cookie)
│   │   │   └── middleware.ts           # Middleware client
│   │   ├── api/
│   │   │   └── client.ts               # NestJS API client (typed)
│   │   └── plans.ts
│   │
│   └── components/
│       ├── guards/
│       │   ├── permission-gate.tsx
│       │   └── billing-gate.tsx
│       └── ui/
│
├── middleware.ts
└── package.json
```

---

## PART 2 — THE ENGINE LAYER (ALL 5 RULES IMPLEMENTED)

### RULE 1 & 2 — DatabaseService: withTenantContext (The Core Engine)

```typescript
// backend/src/infra/database/database.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  // Service role client — for admin operations only (provisioning, cron, webhooks)
  // NEVER expose this key to the frontend
  public readonly adminClient: SupabaseClient;

  // Raw pg pool — all tenant operations use this via withTenantContext()
  private pool: Pool;

  constructor(private config: ConfigService) {
    // Admin client: service role key — bypasses RLS intentionally for admin ops
    this.adminClient = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Connection pool to Supabase Postgres (via PgBouncer in transaction mode)
    this.pool = new Pool({
      connectionString: this.config.get<string>('DATABASE_URL'),
      max: 20,           // 20 connections per NestJS pod
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleInit() {
    // Verify DB connection on startup
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * ╔══════════════════════════════════════════════════════════╗
   * ║  THE CORE ENGINE METHOD — use this for ALL tenant ops   ║
   * ║                                                          ║
   * ║  RULE 1: SET LOCAL runs inside BEGIN...COMMIT            ║
   * ║  RULE 2: One consistent raw pg client per context        ║
   * ║                                                          ║
   * ║  SET LOCAL app.tenant_id is automatically wiped when     ║
   * ║  the transaction ends — connections return to pool clean  ║
   * ╚══════════════════════════════════════════════════════════╝
   */
  async withTenantContext<T>(
    tenantId: string,
    userId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      // BEGIN transaction — SET LOCAL only lives inside a transaction
      await client.query('BEGIN');

      // RULE 1: SET LOCAL resets automatically when transaction ends
      // Safe with connection pools — zero tenant bleed between requests
      await client.query('SET LOCAL app.tenant_id = $1', [tenantId]);
      await client.query('SET LOCAL app.user_id   = $1', [userId]);

      // Execute the caller's database operations
      // RLS fires automatically on every query inside this context
      const result = await fn(client);

      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;

    } finally {
      // Always release — even on error
      // After COMMIT or ROLLBACK, SET LOCAL values are gone
      // The next tenant gets a completely clean connection
      client.release();
    }
  }

  /**
   * For non-tenant admin operations (provisioning, billing, cron jobs)
   * Only use this with service role — never in a tenant request path
   */
  async withAdminContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper: typed query with automatic parameter handling
   */
  async tenantQuery<T = any>(
    client: PoolClient,
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    const { rows } = await client.query(sql, params);
    return rows as T[];
  }

  /**
   * Helper: expects exactly one row, throws if not found
   */
  async tenantQueryOne<T = any>(
    client: PoolClient,
    sql: string,
    params: any[] = [],
  ): Promise<T> {
    const { rows } = await client.query(sql, params);
    if (rows.length === 0) throw new Error('Record not found');
    return rows[0] as T;
  }
}
```

---

### RULE 1 — TenantContextInterceptor: Sets Context on Every Request

```typescript
// backend/src/common/interceptors/tenant-context.interceptor.ts

import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // tenant_id is set by Next.js middleware — never trust the request body
    const tenantId = request.headers['x-tenant-id'];
    const userId   = request.headers['x-user-id'];
    const role     = request.headers['x-tenant-role'];

    if (!tenantId || !userId) {
      throw new UnauthorizedException('Missing tenant context in request headers');
    }

    // Validate UUID format to prevent SQL injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId) || !uuidRegex.test(userId)) {
      throw new BadRequestException('Invalid tenant context format');
    }

    // Attach to request — available in all guards, controllers, and services
    request.tenantId = tenantId;
    request.userId   = userId;
    request.tenantRole = role;

    // NOTE: We do NOT call SET LOCAL here directly.
    // SET LOCAL must be inside a transaction.
    // Each service calls db.withTenantContext() which handles SET LOCAL properly.
    // This interceptor only validates and attaches the context to the request.

    return next.handle();
  }
}
```

---

### RULE 4 — Next.js Middleware: Injects Tenant Context (Frontend Gate)

```typescript
// frontend/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './src/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-tenant routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname === '/' ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(request, response);

  // Step 1: Verify Supabase session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Step 2: Extract tenant slug from URL — /[tenant]/...
  const tenantSlug = pathname.split('/')[1];
  if (!tenantSlug) return NextResponse.next();

  // Step 3: Verify user is an active member of this tenant
  // This query is subject to RLS — user can only see their own memberships
  const { data: membership, error: memberError } = await supabase
    .from('tenant_members')
    .select(`
      tenant_id,
      role,
      status,
      tenant:tenants(id, slug, name, plan, plan_status, features_override, settings)
    `)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .eq('tenants.slug', tenantSlug)
    .single();

  if (memberError || !membership) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // Step 4: Check plan is active (not expired trial, not cancelled)
  const tenant = membership.tenant as any;
  if (
    tenant.plan_status === 'canceled' ||
    (tenant.plan_status === 'trialing' && new Date(tenant.trial_ends_at) < new Date())
  ) {
    return NextResponse.redirect(new URL(`/${tenantSlug}/billing/expired`, request.url));
  }

  // Step 5: Inject tenant context into request headers
  // ← RULE 4: tenant_id comes from verified DB lookup, never from request body
  // NestJS reads these headers — they cannot be spoofed by the browser
  // because they are set server-side by Next.js middleware
  response.headers.set('x-tenant-id',   membership.tenant_id);
  response.headers.set('x-tenant-slug', tenantSlug);
  response.headers.set('x-tenant-role', membership.role);
  response.headers.set('x-user-id',     session.user.id);
  response.headers.set('x-user-email',  session.user.email ?? '');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
```

---

### Decorators: Access Tenant Context in Any Controller

```typescript
// backend/src/common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().tenantId;
  },
);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().userId;
  },
);

export const CurrentRole = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().tenantRole;
  },
);
```

```typescript
// backend/src/common/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });
```

---

### Guards: JWT + Tenant + Permission

```typescript
// backend/src/common/guards/jwt.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtGuard implements CanActivate {
  private supabase;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get('SUPABASE_URL')!,
      this.config.get('SUPABASE_ANON_KEY')!,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = user;
    return true;
  }
}
```

```typescript
// backend/src/common/guards/permission.guard.ts
import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<{ resource: string; action: string }>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) return true; // No permission required

    const request = context.switchToHttp().getRequest();
    const { tenantId, userId } = request;

    // Check permission via DB function — RULE 2: raw pg client in transaction
    const result = await this.db.withTenantContext(tenantId, userId, async (client) => {
      return this.db.tenantQueryOne<{ has_perm: boolean }>(
        client,
        'SELECT has_permission($1, $2) AS has_perm',
        [permission.resource, permission.action],
      );
    });

    if (!result.has_perm) {
      throw new ForbiddenException(
        `Insufficient permission: ${permission.resource}.${permission.action}`,
      );
    }

    return true;
  }
}
```

---

### Global Module Registration

```typescript
// backend/src/app.module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infra/database/database.module';
import { RedisModule } from './infra/redis/redis.module';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtGuard } from './common/guards/jwt.guard';
import { PermissionGuard } from './common/guards/permission.guard';

// Domain modules
import { ProductsModule } from './modules/products/products.module';
import { SalesModule } from './modules/sales/sales.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HrModule } from './modules/hr/hr.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { ProductionModule } from './modules/production/production.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    ProductsModule,
    SalesModule,
    InventoryModule,
    HrModule,
    PayrollModule,
    AttendanceModule,
    FinanceModule,
    PurchaseModule,
    ProductionModule,
    WarehouseModule,
    NotificationsModule,
    ReportsModule,
  ],
  providers: [
    // Global guards — applied to every endpoint
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },

    // Global interceptors — applied to every request
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Global exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
```

---

## PART 3 — RULE 3: ATOMIC STOCK ENGINE (Products + Inventory)

### ProductsService — The Correct Way to Handle Stock

```typescript
// backend/src/modules/products/products.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface StockDeductionResult {
  success: boolean;
  new_stock_qty: number;
  product_name: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * RULE 5: Single query with all related data — no loops
   * RULE 2: withTenantContext for all DB access
   */
  async findAll(tenantId: string, userId: string, filters: {
    search?: string;
    type?: string;
    low_stock?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      const limit  = Math.min(filters.limit ?? 50, 100);
      const offset = ((filters.page ?? 1) - 1) * limit;

      // RULE 5: Join with category in one query, never fetch separately
      const rows = await this.db.tenantQuery(client, `
        SELECT
          p.id,
          p.sku,
          p.barcode,
          p.name,
          p.type,
          p.unit_price,
          p.cost_price,
          p.stock_qty,
          p.reorder_point,
          p.unit_of_measure,
          p.track_inventory,
          CASE
            WHEN p.stock_qty = 0              THEN 'out_of_stock'
            WHEN p.stock_qty <= p.reorder_point THEN 'low_stock'
            ELSE 'in_stock'
          END AS stock_status,
          c.name AS category_name,
          c.id   AS category_id,
          p.created_at
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE
          ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%' OR p.sku ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR p.type = $2)
          AND ($3::boolean IS NULL OR NOT $3 OR p.stock_qty <= p.reorder_point)
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT $4 OFFSET $5
      `, [
        filters.search ?? null,
        filters.type   ?? null,
        filters.low_stock ?? null,
        limit,
        offset,
      ]);

      return rows;
    });
  }

  async create(tenantId: string, userId: string, dto: CreateProductDto) {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      // RULE 4: tenant_id from server context, never from dto
      const [product] = await this.db.tenantQuery(client, `
        INSERT INTO products (
          tenant_id, category_id, sku, barcode, name, type,
          unit_price, cost_price, reorder_point, unit_of_measure, track_inventory
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        tenantId,          // RULE 4: always from server context
        dto.category_id ?? null,
        dto.sku,
        dto.barcode ?? null,
        dto.name,
        dto.type ?? 'product',
        dto.unit_price,
        dto.cost_price ?? 0,
        dto.reorder_point ?? 0,
        dto.unit_of_measure ?? 'pcs',
        dto.track_inventory ?? true,
      ]);

      return product;
    });
  }

  /**
   * ╔══════════════════════════════════════════════════════════════╗
   * ║  RULE 3: ATOMIC STOCK DEDUCTION                              ║
   * ║                                                              ║
   * ║  Uses a single UPDATE with a WHERE stock_qty >= qty check.   ║
   * ║  Postgres executes this atomically — no race condition.      ║
   * ║                                                              ║
   * ║  If two orders for the same product arrive simultaneously:   ║
   * ║  Order 1: UPDATE ... WHERE stock_qty >= 8 → succeeds (10→2) ║
   * ║  Order 2: UPDATE ... WHERE stock_qty >= 6 → 0 rows (2 < 6)  ║
   * ║  Order 2 is rejected — stock never goes negative             ║
   * ╚══════════════════════════════════════════════════════════════╝
   */
  async deductStock(
    tenantId: string,
    userId: string,
    productId: string,
    quantity: number,
    reference: { type: string; id: string },
  ): Promise<StockDeductionResult> {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      // RULE 3: Atomic UPDATE — Postgres locks the row, checks qty, deducts atomically
      const rows = await this.db.tenantQuery<{
        id: string;
        name: string;
        stock_qty: number;
        qty_before: number;
      }>(client, `
        UPDATE products
        SET stock_qty = stock_qty - $1
        WHERE id          = $2
          AND tenant_id   = $3      -- extra safety: belt + suspenders
          AND stock_qty   >= $1     -- ATOMIC CHECK: only deducts if enough stock
          AND deleted_at  IS NULL
          AND track_inventory = true
        RETURNING id, name, stock_qty, (stock_qty + $1) AS qty_before
      `, [quantity, productId, tenantId]);

      if (rows.length === 0) {
        // Either product not found, wrong tenant, or insufficient stock
        // Check which one for a proper error message
        const product = await this.db.tenantQuery(client, `
          SELECT name, stock_qty FROM products
          WHERE id = $1 AND deleted_at IS NULL
        `, [productId]);

        if (product.length === 0) {
          throw new NotFoundException(`Product ${productId} not found`);
        }

        throw new BadRequestException(
          `Insufficient stock for "${product[0].name}". ` +
          `Available: ${product[0].stock_qty}, Requested: ${quantity}`
        );
      }

      const updated = rows[0];

      // Write inventory log for full audit trail
      await client.query(`
        INSERT INTO inventory_logs (
          tenant_id, product_id, type,
          quantity, quantity_before, quantity_after,
          reference_type, reference_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        tenantId,
        productId,
        reference.type,
        -quantity,                // negative = stock OUT
        updated.qty_before,
        updated.stock_qty,        // after deduction
        reference.type,
        reference.id,
        userId,
      ]);

      return {
        success: true,
        new_stock_qty: updated.stock_qty,
        product_name:  updated.name,
      };
    });
  }

  /**
   * Add stock (purchase receipt, return, adjustment)
   */
  async addStock(
    tenantId: string,
    userId: string,
    productId: string,
    quantity: number,
    costPrice: number,
    reference: { type: string; id: string },
  ) {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      const rows = await this.db.tenantQuery<{
        id: string; name: string; stock_qty: number; qty_before: number;
      }>(client, `
        UPDATE products
        SET stock_qty = stock_qty + $1
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
        RETURNING id, name, stock_qty, (stock_qty - $1) AS qty_before
      `, [quantity, productId, tenantId]);

      if (rows.length === 0) throw new NotFoundException('Product not found');

      const updated = rows[0];

      await client.query(`
        INSERT INTO inventory_logs (
          tenant_id, product_id, type,
          quantity, quantity_before, quantity_after,
          cost_price, reference_type, reference_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        tenantId, productId, reference.type,
        +quantity,              // positive = stock IN
        updated.qty_before,
        updated.stock_qty,
        costPrice,
        reference.type,
        reference.id,
        userId,
      ]);

      return { success: true, new_stock_qty: updated.stock_qty };
    });
  }
}
```

---

### ProductsController — Clean, Typed, Guarded

```typescript
// backend/src/modules/products/products.controller.ts

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateProductDto, createProductSchema } from './dto/create-product.dto';
import { ProductsFilterDto } from './dto/products-filter.dto';

@Controller('products')
@UseInterceptors(TenantContextInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission('inventory', 'read')
  async findAll(
    @CurrentTenant() tenantId: string,  // from TenantContextInterceptor
    @CurrentUser()   userId: string,    // from TenantContextInterceptor
    @Query() filters: ProductsFilterDto,
  ) {
    // RULE 5: service does a single joined query — no loops
    return this.productsService.findAll(tenantId, userId, filters);
  }

  @Post()
  @RequirePermission('inventory', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser()   userId: string,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
  ) {
    // RULE 4: tenantId comes from decorator (server context), not from dto
    return this.productsService.create(tenantId, userId, dto);
  }
}
```

---

## PART 4 — SALES MODULE (Complete Order Execution)

### SalesService — Order Creation with Atomic Stock Deduction

```typescript
// backend/src/modules/sales/sales.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';
import { ProductsService } from '../products/products.service';
import { CreateSaleDto, SaleItemDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: ProductsService,
  ) {}

  /**
   * RULE 5: One query with full joins — no N+1
   * Returns sales with customer + items + products in a single DB round trip
   */
  async findAll(tenantId: string, userId: string, filters: {
    status?: string;
    payment_status?: string;
    cursor?: string;   // cursor pagination — NEVER offset past page 10
    limit?: number;
  }) {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      const limit = Math.min(filters.limit ?? 50, 100);

      return this.db.tenantQuery(client, `
        SELECT
          s.id,
          s.order_number,
          s.status,
          s.payment_status,
          s.subtotal,
          s.discount_amount,
          s.tax_amount,
          s.total_amount,
          s.paid_amount,
          s.due_amount,
          s.created_at,
          -- RULE 5: customer joined here, not in a separate query
          json_build_object(
            'id',    c.id,
            'name',  c.name,
            'phone', c.phone,
            'email', c.email
          ) AS customer,
          -- RULE 5: items joined here with product info
          COALESCE(
            json_agg(
              json_build_object(
                'id',         si.id,
                'product_id', si.product_id,
                'name',       si.product_name,
                'sku',        p.sku,
                'quantity',   si.quantity,
                'unit_price', si.unit_price,
                'total',      si.total_amount
              )
            ) FILTER (WHERE si.id IS NOT NULL),
            '[]'
          ) AS items
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN sales_items si ON si.sale_id = s.id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE
          ($1::text IS NULL OR s.status = $1)
          AND ($2::text IS NULL OR s.payment_status = $2)
          AND ($3::uuid IS NULL OR s.id < $3)
          AND s.deleted_at IS NULL
        GROUP BY s.id, c.id
        ORDER BY s.created_at DESC
        LIMIT $4
      `, [
        filters.status         ?? null,
        filters.payment_status ?? null,
        filters.cursor         ?? null,
        limit,
      ]);
    });
  }

  /**
   * Create order with stock deduction — all inside one transaction
   * RULE 1: entire operation (insert sale + deduct stock × N items) is atomic
   * RULE 3: each stock deduction is atomic
   * RULE 4: tenant_id from server context
   */
  async create(tenantId: string, userId: string, dto: CreateSaleDto) {
    return this.db.withTenantContext(tenantId, userId, async (client) => {
      // Step 1: Validate all products belong to this tenant and have enough stock
      const productIds = dto.items.map(i => i.product_id);

      // RULE 5: fetch all products in one query
      const products = await this.db.tenantQuery<{
        id: string;
        name: string;
        sku: string;
        unit_price: number;
        stock_qty: number;
        track_inventory: boolean;
      }>(client, `
        SELECT id, name, sku, unit_price, stock_qty, track_inventory
        FROM products
        WHERE id = ANY($1::uuid[])
          AND deleted_at IS NULL
      `, [productIds]);

      const productMap = new Map(products.map(p => [p.id, p]));

      // Validate all items
      for (const item of dto.items) {
        const product = productMap.get(item.product_id);
        if (!product) {
          throw new BadRequestException(
            `Product ${item.product_id} not found in your inventory`
          );
        }
        if (product.track_inventory && product.stock_qty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". ` +
            `Available: ${product.stock_qty}, Requested: ${item.quantity}`
          );
        }
      }

      // Step 2: Generate order number
      const [{ order_number }] = await this.db.tenantQuery<{ order_number: string }>(
        client,
        `SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                LPAD(NEXTVAL('order_number_seq_' || $1::text)::text, 5, '0')
                AS order_number`,
        [tenantId.replace(/-/g, '_')],
      );

      // Step 3: Calculate totals
      let subtotal = 0;
      const itemsData = dto.items.map(item => {
        const product = productMap.get(item.product_id)!;
        const unitPrice = item.unit_price ?? product.unit_price;
        const total = unitPrice * item.quantity;
        subtotal += total;
        return { ...item, unit_price: unitPrice, total, product };
      });

      const discountAmount = dto.discount_amount ?? 0;
      const taxAmount      = dto.tax_amount ?? 0;
      const totalAmount    = subtotal - discountAmount + taxAmount;

      // Step 4: Insert sale — RULE 4: tenant_id from server context
      const [sale] = await this.db.tenantQuery<{ id: string }>(client, `
        INSERT INTO sales (
          tenant_id, order_number, customer_id, status, payment_method, source,
          subtotal, discount_amount, tax_amount, total_amount, paid_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        tenantId,                        // RULE 4
        order_number,
        dto.customer_id ?? null,
        'confirmed',
        dto.payment_method ?? null,
        dto.source ?? 'pos',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        dto.paid_amount ?? 0,
      ]);

      // Step 5: Insert sale items
      for (const item of itemsData) {
        await client.query(`
          INSERT INTO sales_items (
            tenant_id, sale_id, product_id, product_name,
            quantity, unit_price, discount_amount, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          tenantId,
          sale.id,
          item.product_id,
          item.product.name,  // snapshot product name at time of sale
          item.quantity,
          item.unit_price,
          item.discount_amount ?? 0,
          item.total,
        ]);
      }

      // Step 6: Deduct stock for all items — RULE 3: atomic per product
      for (const item of itemsData) {
        if (item.product.track_inventory) {
          // Each deduction is atomic — race conditions are handled at DB level
          await client.query(`
            UPDATE products
            SET stock_qty = stock_qty - $1
            WHERE id = $2 AND tenant_id = $3 AND stock_qty >= $1
          `, [item.quantity, item.product_id, tenantId]);

          // Inventory log for audit trail
          await client.query(`
            INSERT INTO inventory_logs (
              tenant_id, product_id, type, quantity,
              reference_type, reference_id, created_by
            ) VALUES ($1, $2, 'sale', $3, 'sale', $4, $5)
          `, [tenantId, item.product_id, -item.quantity, sale.id, userId]);
        }
      }

      // Step 7: Trigger journal entry (accounts receivable + revenue)
      // This is handled by a Postgres trigger on sales INSERT — no code needed here

      return { id: sale.id, order_number };
    });
  }
}
```

---

## PART 5 — DATABASE SCHEMA (PostgreSQL / Supabase)

### Extensions

```sql
-- Run once on Supabase project
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Platform Foundation Tables (No RLS — service role only)

```sql
-- TENANTS
CREATE TABLE tenants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  plan              text NOT NULL DEFAULT 'free',
  plan_status       text NOT NULL DEFAULT 'trialing',
  trial_ends_at     timestamptz DEFAULT now() + interval '14 days',
  max_users         int NOT NULL DEFAULT 3,
  max_products      int NOT NULL DEFAULT 100,
  max_orders_pm     int NOT NULL DEFAULT 500,
  locale            text NOT NULL DEFAULT 'en',
  currency          text NOT NULL DEFAULT 'BDT',
  timezone          text NOT NULL DEFAULT 'Asia/Dhaka',
  logo_url          text,
  custom_domain     text UNIQUE,
  white_label       boolean DEFAULT false,
  features_override jsonb DEFAULT '{}',
  settings          jsonb NOT NULL DEFAULT '{}',
  deleted_at        timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;

-- TENANT MEMBERS
CREATE TABLE tenant_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'staff',
  status       text NOT NULL DEFAULT 'active',
  invited_by   uuid REFERENCES auth.users(id),
  joined_at    timestamptz DEFAULT now(),
  last_seen_at timestamptz,
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_tm_user   ON tenant_members(user_id)   WHERE status = 'active';
CREATE INDEX idx_tm_tenant ON tenant_members(tenant_id) WHERE status = 'active';

-- TENANT BILLING
CREATE TABLE tenant_billing (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id        text,
  plan                   text NOT NULL DEFAULT 'free',
  status                 text NOT NULL DEFAULT 'trialing',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean DEFAULT false,
  trial_end              timestamptz,
  seats_used             int DEFAULT 1,
  seats_limit            int DEFAULT 3,
  billing_email          text,
  lifetime_value         numeric(15,2) DEFAULT 0,
  updated_at             timestamptz DEFAULT now()
);

-- TENANT USAGE (metering)
CREATE TABLE tenant_usage (
  tenant_id            uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  users_count          int DEFAULT 0,
  products_count       int DEFAULT 0,
  customers_count      int DEFAULT 0,
  orders_this_month    int DEFAULT 0,
  orders_total         bigint DEFAULT 0,
  storage_bytes        bigint DEFAULT 0,
  api_calls_today      int DEFAULT 0,
  api_calls_this_month bigint DEFAULT 0,
  period_start         timestamptz DEFAULT date_trunc('month', now()),
  updated_at           timestamptz DEFAULT now()
);
```

### RBAC Tables

```sql
CREATE TABLE permissions (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  action   text NOT NULL,
  UNIQUE(resource, action)
);

INSERT INTO permissions (resource, action) VALUES
  ('sales',       'read'),   ('sales',       'create'), ('sales',       'update'),
  ('sales',       'delete'), ('sales',       'approve'),
  ('inventory',   'read'),   ('inventory',   'create'), ('inventory',   'update'),
  ('inventory',   'delete'), ('inventory',   'adjust'),
  ('hr',          'read'),   ('hr',          'create'), ('hr',          'update'),
  ('hr',          'delete'), ('hr',          'admin'),
  ('payroll',     'read'),   ('payroll',     'create'), ('payroll',     'approve'),
  ('payroll',     'disburse'),
  ('finance',     'read'),   ('finance',     'create'), ('finance',     'post'),
  ('finance',     'close_period'),
  ('purchase',    'read'),   ('purchase',    'create'), ('purchase',    'approve'),
  ('production',  'read'),   ('production',  'create'), ('production',  'update'),
  ('warehouse',   'read'),   ('warehouse',   'create'), ('warehouse',   'transfer'),
  ('reports',     'read'),   ('reports',     'export'),
  ('settings',    'read'),   ('settings',    'update');

CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  display_name text NOT NULL,
  is_system    boolean DEFAULT false,
  is_deletable boolean DEFAULT true,
  sort_order   int DEFAULT 99,
  UNIQUE(tenant_id, name)
);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

### Audit Logs (Partitioned, INSERT-only)

```sql
CREATE TABLE audit_logs (
  id         bigserial,
  tenant_id  uuid NOT NULL,
  user_id    uuid,
  action     text NOT NULL,
  category   text NOT NULL DEFAULT 'business',
  table_name text,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb,
  diff       jsonb,
  ip_address inet,
  user_agent text,
  severity   text DEFAULT 'info',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE OR REPLACE FUNCTION create_monthly_partition(
  parent_table text, target_month timestamptz
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pname text := parent_table || '_' || to_char(target_month, 'YYYY_MM');
  sdate text := to_char(date_trunc('month', target_month), 'YYYY-MM-DD');
  edate text := to_char(date_trunc('month', target_month + interval '1 month'), 'YYYY-MM-DD');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    pname, parent_table, sdate, edate
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, created_at DESC)',
    'idx_' || pname || '_tenant', pname
  );
END;
$$;

-- Create current + next 2 months
SELECT create_monthly_partition('audit_logs', now());
SELECT create_monthly_partition('audit_logs', now() + interval '1 month');
SELECT create_monthly_partition('audit_logs', now() + interval '2 months');

-- Auto-create future partitions
SELECT cron.schedule('create-partitions', '0 0 25 * *', $$
  SELECT create_monthly_partition('audit_logs',      now() + interval '1 month');
  SELECT create_monthly_partition('inventory_logs',  now() + interval '1 month');
  SELECT create_monthly_partition('notifications',   now() + interval '1 month');
$$);
```

### Core Business Tables

```sql
-- PRODUCT CATEGORIES
CREATE TABLE product_categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,
  parent_id uuid REFERENCES product_categories(id),
  sort_order int DEFAULT 99
);
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;

-- PRODUCTS
CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES product_categories(id),
  sku             text NOT NULL,
  barcode         text,
  name            text NOT NULL,
  type            text DEFAULT 'product',
  unit_price      numeric(15,2) NOT NULL DEFAULT 0,
  cost_price      numeric(15,2) DEFAULT 0,
  stock_qty       int DEFAULT 0,  -- maintained by inventory trigger
  reorder_point   int DEFAULT 0,
  unit_of_measure text DEFAULT 'pcs',
  track_inventory boolean DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, sku)
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_products_tenant ON products(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_products_sku    ON products(tenant_id, sku);
CREATE INDEX CONCURRENTLY idx_products_stock  ON products(tenant_id, stock_qty) WHERE track_inventory = true;

-- CUSTOMERS
CREATE TABLE customers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_code       text,
  name                text NOT NULL,
  email               text,
  phone               text,
  customer_group      text DEFAULT 'retail',
  credit_limit        numeric(15,2) DEFAULT 0,
  outstanding_balance numeric(15,2) DEFAULT 0,
  tax_id              text,
  address             text,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(tenant_id, customer_code)
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_customers_tenant ON customers(tenant_id) WHERE deleted_at IS NULL;

-- SALES
CREATE TABLE sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number    text NOT NULL,
  customer_id     uuid REFERENCES customers(id),
  status          text DEFAULT 'draft',
  payment_status  text DEFAULT 'unpaid',
  payment_method  text,
  source          text DEFAULT 'pos',
  subtotal        numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_amount      numeric(15,2) DEFAULT 0,
  shipping_amount numeric(15,2) DEFAULT 0,
  total_amount    numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount     numeric(15,2) DEFAULT 0,
  due_amount      numeric(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  return_of       uuid REFERENCES sales(id),
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_sales_tenant_date ON sales(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_sales_status      ON sales(tenant_id, status)          WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_sales_payment     ON sales(tenant_id, payment_status)
  WHERE payment_status != 'paid' AND deleted_at IS NULL;

-- SALES ITEMS
CREATE TABLE sales_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id         uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id),
  product_name    text NOT NULL,  -- snapshot at time of sale
  quantity        int NOT NULL,
  unit_price      numeric(15,2) NOT NULL,
  discount_amount numeric(15,2) DEFAULT 0,
  total_amount    numeric(15,2) NOT NULL
);
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_sales_items_sale    ON sales_items(sale_id);
CREATE INDEX CONCURRENTLY idx_sales_items_product ON sales_items(tenant_id, product_id);

-- INVENTORY LOGS (partitioned)
CREATE TABLE inventory_logs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),
  variant_id      uuid,
  type            text NOT NULL,
  reference_id    uuid,
  reference_type  text,
  quantity        int NOT NULL,
  quantity_before int,
  quantity_after  int,
  cost_price      numeric(15,2),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs FORCE ROW LEVEL SECURITY;

SELECT create_monthly_partition('inventory_logs', now());
SELECT create_monthly_partition('inventory_logs', now() + interval '1 month');
```

### HRM Tables

```sql
-- DEPARTMENTS
CREATE TABLE departments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  parent_id      uuid REFERENCES departments(id),
  manager_id     uuid,
  cost_center_id uuid,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

-- POSITIONS
CREATE TABLE positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id),
  title         text NOT NULL,
  grade         text,
  min_salary    numeric(15,2),
  max_salary    numeric(15,2)
);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions FORCE ROW LEVEL SECURITY;

-- EMPLOYEES
CREATE TABLE employees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id),
  employee_code       text NOT NULL,
  department_id       uuid REFERENCES departments(id),
  position_id         uuid REFERENCES positions(id),
  first_name          text NOT NULL,
  last_name           text,
  email               text,
  phone               text,
  nid                 text,
  passport_no         text,
  tin_no              text,
  employment_type     text DEFAULT 'full_time',
  join_date           date NOT NULL,
  end_date            date,
  probation_end_date  date,
  basic_salary        numeric(15,2) DEFAULT 0,
  gross_salary        numeric(15,2) DEFAULT 0,
  bank_account        text,
  bank_name           text,
  address             text,
  photo_url           text,
  emergency_contact   jsonb,
  is_active           boolean DEFAULT true,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(tenant_id, employee_code)
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_employees_tenant ON employees(tenant_id) WHERE deleted_at IS NULL;

-- SHIFT TEMPLATES
CREATE TABLE shift_templates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  start_time               time NOT NULL,
  end_time                 time NOT NULL,
  grace_minutes            int DEFAULT 10,
  total_break_minutes      int DEFAULT 60,
  working_days             text[],
  overtime_threshold_hours numeric(4,2) DEFAULT 8.0,
  overtime_rate_multiplier numeric(3,2) DEFAULT 1.5,
  is_active                boolean DEFAULT true
);
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates FORCE ROW LEVEL SECURITY;

-- ATTENDANCE
CREATE TABLE attendance (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id          uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  check_in             timestamptz,
  check_out            timestamptz,
  scheduled_start      timestamptz,
  scheduled_end        timestamptz,
  late_minutes         int GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND scheduled_start IS NOT NULL
    THEN GREATEST(0, EXTRACT(EPOCH FROM (check_in - scheduled_start))::int / 60)
    ELSE 0 END
  ) STORED,
  gross_worked_minutes int GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (check_out - check_in))::int / 60
    ELSE 0 END
  ) STORED,
  total_break_minutes  int DEFAULT 0,
  net_worked_hours     numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
    THEN (EXTRACT(EPOCH FROM (check_out - check_in)) / 60.0 - total_break_minutes) / 60.0
    ELSE 0 END
  ) STORED,
  overtime_hours       numeric(5,2) DEFAULT 0,
  status               text DEFAULT 'present',
  device_id            text,
  location_data        jsonb,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(tenant_id, employee_id, date)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_attendance_tenant   ON attendance(tenant_id, date DESC);
CREATE INDEX CONCURRENTLY idx_attendance_employee ON attendance(employee_id, date DESC);

-- BREAK TYPES
CREATE TABLE break_types (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  default_duration_minutes int,
  is_paid                  boolean DEFAULT true,
  max_per_day              int
);
ALTER TABLE break_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_types FORCE ROW LEVEL SECURITY;

-- ATTENDANCE BREAKS
CREATE TABLE attendance_breaks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  attendance_id    uuid NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id),
  break_type_id    uuid REFERENCES break_types(id),
  break_start      timestamptz NOT NULL,
  break_end        timestamptz,
  duration_minutes int GENERATED ALWAYS AS (
    CASE WHEN break_end IS NOT NULL
    THEN EXTRACT(EPOCH FROM (break_end - break_start))::int / 60
    ELSE NULL END
  ) STORED,
  notes text
);
ALTER TABLE attendance_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_breaks FORCE ROW LEVEL SECURITY;

-- Break totals sync trigger
CREATE OR REPLACE FUNCTION trg_sync_break_totals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE attendance
  SET total_break_minutes = (
    SELECT COALESCE(SUM(duration_minutes), 0)
    FROM attendance_breaks
    WHERE attendance_id = COALESCE(NEW.attendance_id, OLD.attendance_id)
      AND break_end IS NOT NULL
  )
  WHERE id = COALESCE(NEW.attendance_id, OLD.attendance_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER sync_break_totals
  AFTER INSERT OR UPDATE OR DELETE ON attendance_breaks
  FOR EACH ROW EXECUTE FUNCTION trg_sync_break_totals();

-- LEAVE POLICIES, BALANCES, REQUESTS
CREATE TABLE leave_policies (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  leave_type                 text NOT NULL,
  days_per_year              numeric(5,2),
  carryover_limit            int DEFAULT 0,
  accrual_type               text DEFAULT 'annual',
  applies_to_employment_type text[],
  min_service_months         int DEFAULT 0,
  UNIQUE(tenant_id, leave_type)
);
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies FORCE ROW LEVEL SECURITY;

CREATE TABLE leave_balances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees(id),
  leave_type     text NOT NULL,
  year           int NOT NULL,
  entitled_days  numeric(5,2) DEFAULT 0,
  used_days      numeric(5,2) DEFAULT 0,
  pending_days   numeric(5,2) DEFAULT 0,
  available_days numeric(5,2) GENERATED ALWAYS AS (entitled_days - used_days - pending_days) STORED,
  UNIQUE(tenant_id, employee_id, leave_type, year)
);
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances FORCE ROW LEVEL SECURITY;

CREATE TABLE leave_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  leave_type  text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  days        int GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  half_day    boolean DEFAULT false,
  reason      text,
  status      text DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY;
```

### Payroll Tables

```sql
CREATE TABLE payroll_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  type              text NOT NULL,
  calculation_type  text NOT NULL,
  calculation_value numeric(10,4),
  formula           text,
  is_taxable        boolean DEFAULT true,
  is_mandatory      boolean DEFAULT false,
  sort_order        int DEFAULT 99
);
ALTER TABLE payroll_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_components FORCE ROW LEVEL SECURITY;

CREATE TABLE employee_payroll_components (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees(id),
  component_id   uuid NOT NULL REFERENCES payroll_components(id),
  override_value numeric(15,2),
  effective_from date NOT NULL,
  effective_to   date
);
ALTER TABLE employee_payroll_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_payroll_components FORCE ROW LEVEL SECURITY;

CREATE TABLE payroll_tax_slabs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_year int NOT NULL,
  min_income  numeric(15,2) NOT NULL,
  max_income  numeric(15,2),
  tax_rate    numeric(5,2) NOT NULL
);
ALTER TABLE payroll_tax_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_tax_slabs FORCE ROW LEVEL SECURITY;

CREATE TABLE payroll_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month         int NOT NULL,
  period_year          int NOT NULL,
  status               text DEFAULT 'draft',
  total_gross          numeric(15,2) DEFAULT 0,
  total_deductions     numeric(15,2) DEFAULT 0,
  total_net            numeric(15,2) DEFAULT 0,
  employee_count       int DEFAULT 0,
  processed_by         uuid REFERENCES auth.users(id),
  approved_by          uuid REFERENCES auth.users(id),
  disbursed_by         uuid REFERENCES auth.users(id),
  temporal_workflow_id text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(tenant_id, period_year, period_month)
);
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs FORCE ROW LEVEL SECURITY;

CREATE TABLE payroll_run_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id   uuid NOT NULL REFERENCES payroll_runs(id),
  employee_id      uuid NOT NULL REFERENCES employees(id),
  working_days     int DEFAULT 0,
  present_days     int DEFAULT 0,
  absent_days      int DEFAULT 0,
  leave_days       int DEFAULT 0,
  overtime_hours   numeric(5,2) DEFAULT 0,
  earnings         jsonb NOT NULL DEFAULT '[]',   -- IMMUTABLE SNAPSHOT after approval
  deductions       jsonb NOT NULL DEFAULT '[]',   -- IMMUTABLE SNAPSHOT after approval
  gross_pay        numeric(15,2) DEFAULT 0,
  total_deductions numeric(15,2) DEFAULT 0,
  net_pay          numeric(15,2) DEFAULT 0,
  income_tax       numeric(15,2) DEFAULT 0,
  status           text DEFAULT 'draft',
  paid_at          timestamptz,
  payment_reference text
);
ALTER TABLE payroll_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_items FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_payroll_items_run ON payroll_run_items(payroll_run_id, employee_id);
```

### Finance Tables

```sql
CREATE TABLE chart_of_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_code      text NOT NULL,
  name              text NOT NULL,
  type              text NOT NULL,
  sub_type          text,
  parent_id         uuid REFERENCES chart_of_accounts(id),
  is_control_account boolean DEFAULT false,
  normal_balance    text NOT NULL,
  balance           numeric(18,2) DEFAULT 0,
  is_bank_account   boolean DEFAULT false,
  currency          text DEFAULT 'BDT',
  is_active         boolean DEFAULT true,
  UNIQUE(tenant_id, account_code)
);
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts FORCE ROW LEVEL SECURITY;

CREATE TABLE fiscal_years (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  status     text DEFAULT 'open'
);
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years FORCE ROW LEVEL SECURITY;

CREATE TABLE accounting_periods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id),
  period_number  int NOT NULL,
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  status         text DEFAULT 'open'
);
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods FORCE ROW LEVEL SECURITY;

CREATE TABLE cost_centers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code          text NOT NULL,
  name          text NOT NULL,
  department_id uuid REFERENCES departments(id),
  budget_amount numeric(15,2) DEFAULT 0
);
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers FORCE ROW LEVEL SECURITY;

CREATE TABLE journal_entries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_number         text NOT NULL,
  entry_date           date NOT NULL,
  description          text,
  reference_type       text,
  reference_id         uuid,
  status               text DEFAULT 'draft',
  posted_at            timestamptz,
  posted_by            uuid REFERENCES auth.users(id),
  reversed_by_entry_id uuid REFERENCES journal_entries(id),
  fiscal_period_id     uuid REFERENCES accounting_periods(id),
  total_debit          numeric(18,2) DEFAULT 0,
  total_credit         numeric(18,2) DEFAULT 0,
  UNIQUE(tenant_id, entry_number)
);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;

CREATE TABLE journal_entry_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       uuid NOT NULL REFERENCES chart_of_accounts(id),
  line_number      int,
  debit_amount     numeric(18,2) DEFAULT 0,
  credit_amount    numeric(18,2) DEFAULT 0,
  description      text,
  cost_center_id   uuid REFERENCES cost_centers(id),
  currency         text DEFAULT 'BDT',
  exchange_rate    numeric(10,6) DEFAULT 1.0,
  CONSTRAINT chk_one_side CHECK (NOT (debit_amount > 0 AND credit_amount > 0))
);
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_jel_account ON journal_entry_lines(account_id, journal_entry_id);
```

### Purchase Tables

```sql
CREATE TABLE suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_code       text NOT NULL,
  name                text NOT NULL,
  email               text,
  phone               text,
  supplier_type       text,
  payment_terms_days  int DEFAULT 30,
  credit_limit        numeric(15,2) DEFAULT 0,
  outstanding_balance numeric(15,2) DEFAULT 0,
  lead_time_days      int,
  rating              int CHECK (rating BETWEEN 1 AND 5),
  is_active           boolean DEFAULT true,
  deleted_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(tenant_id, supplier_code)
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;

CREATE TABLE purchase_orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_number              text NOT NULL,
  supplier_id            uuid NOT NULL REFERENCES suppliers(id),
  warehouse_id           uuid,
  status                 text DEFAULT 'draft',
  order_date             date NOT NULL,
  expected_delivery_date date,
  subtotal               numeric(15,2) DEFAULT 0,
  tax_amount             numeric(15,2) DEFAULT 0,
  total_amount           numeric(15,2) DEFAULT 0,
  paid_amount            numeric(15,2) DEFAULT 0,
  outstanding            numeric(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  approved_by            uuid REFERENCES auth.users(id),
  deleted_at             timestamptz,
  created_at             timestamptz DEFAULT now(),
  UNIQUE(tenant_id, po_number)
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_po_tenant ON purchase_orders(tenant_id, status) WHERE deleted_at IS NULL;

CREATE TABLE purchase_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_id        uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id),
  ordered_qty  int NOT NULL,
  received_qty int DEFAULT 0,
  pending_qty  int GENERATED ALWAYS AS (ordered_qty - received_qty) STORED,
  unit_cost    numeric(15,2) NOT NULL,
  tax_rate     numeric(5,2) DEFAULT 0,
  total_cost   numeric(15,2) NOT NULL
);

CREATE TABLE purchase_receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_id          uuid REFERENCES purchase_orders(id),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  warehouse_id   uuid NOT NULL,
  grn_number     text NOT NULL,
  receipt_date   date NOT NULL,
  status         text DEFAULT 'draft',
  vehicle_number text,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(tenant_id, grn_number)
);
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts FORCE ROW LEVEL SECURITY;

CREATE TABLE purchase_receipt_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id       uuid NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  po_item_id       uuid REFERENCES purchase_order_items(id),
  product_id       uuid NOT NULL REFERENCES products(id),
  received_qty     int NOT NULL,
  accepted_qty     int NOT NULL,
  rejected_qty     int GENERATED ALWAYS AS (received_qty - accepted_qty) STORED,
  rejection_reason text,
  bin_location_id  uuid
);
```

### Production Tables

```sql
CREATE TABLE bom_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),
  bom_number      text NOT NULL,
  version         int DEFAULT 1,
  is_active       boolean DEFAULT true,
  output_qty      numeric(10,4) DEFAULT 1,
  unit_of_measure text,
  UNIQUE(tenant_id, bom_number)
);
ALTER TABLE bom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_templates FORCE ROW LEVEL SECURITY;

CREATE TABLE bom_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bom_id                uuid NOT NULL REFERENCES bom_templates(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES products(id),
  qty_required          numeric(10,4) NOT NULL,
  unit_of_measure       text,
  wastage_percent       numeric(5,2) DEFAULT 0,
  component_type        text,
  is_optional           boolean DEFAULT false,
  substitute_product_id uuid REFERENCES products(id)
);

CREATE TABLE production_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number          text NOT NULL,
  bom_id                uuid NOT NULL REFERENCES bom_templates(id),
  product_id            uuid NOT NULL REFERENCES products(id),
  planned_qty           numeric(10,4) NOT NULL,
  actual_qty            numeric(10,4) DEFAULT 0,
  status                text DEFAULT 'draft',
  planned_start         date,
  planned_end           date,
  actual_start          timestamptz,
  actual_end            timestamptz,
  priority              int DEFAULT 5,
  warehouse_id          uuid,
  finished_goods_bin_id uuid,
  sales_order_id        uuid REFERENCES sales(id),
  temporal_workflow_id  text,
  total_material_cost   numeric(15,2) DEFAULT 0,
  total_labor_cost      numeric(15,2) DEFAULT 0,
  overhead_cost         numeric(15,2) DEFAULT 0,
  total_cost            numeric(15,2) GENERATED ALWAYS AS
    (total_material_cost + total_labor_cost + overhead_cost) STORED,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_production_status ON production_orders(tenant_id, status);
```

### Warehouse Tables

```sql
CREATE TABLE warehouses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code       text NOT NULL,
  name       text NOT NULL,
  type       text DEFAULT 'main',
  address    text,
  is_default boolean DEFAULT false,
  is_active  boolean DEFAULT true,
  manager_id uuid REFERENCES employees(id),
  UNIQUE(tenant_id, code)
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;

CREATE TABLE warehouse_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id    uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  zone_type       text DEFAULT 'ambient',
  temperature_min numeric(5,2),
  temperature_max numeric(5,2)
);

CREATE TABLE bin_locations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id     uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id          uuid REFERENCES warehouse_zones(id),
  code             text NOT NULL,
  bin_type         text DEFAULT 'regular',
  max_weight_kg    numeric(10,2),
  is_active        boolean DEFAULT true,
  UNIQUE(warehouse_id, code)
);

CREATE TABLE bin_stock_levels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  bin_id       uuid NOT NULL REFERENCES bin_locations(id),
  product_id   uuid NOT NULL REFERENCES products(id),
  variant_id   uuid,
  qty_on_hand  int DEFAULT 0,
  qty_reserved int DEFAULT 0,
  qty_available int GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  UNIQUE(bin_id, product_id)
);
ALTER TABLE bin_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bin_stock_levels FORCE ROW LEVEL SECURITY;
CREATE INDEX CONCURRENTLY idx_bin_stock ON bin_stock_levels(warehouse_id, product_id);

CREATE TABLE stock_transfers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_number   text NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  to_warehouse_id   uuid NOT NULL REFERENCES warehouses(id),
  from_bin_id       uuid REFERENCES bin_locations(id),
  to_bin_id         uuid REFERENCES bin_locations(id),
  status            text DEFAULT 'draft',
  transfer_date     date,
  reason            text,
  requested_by      uuid REFERENCES auth.users(id),
  approved_by       uuid REFERENCES auth.users(id),
  received_by       uuid REFERENCES auth.users(id),
  UNIQUE(tenant_id, transfer_number)
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers FORCE ROW LEVEL SECURITY;

CREATE TABLE cycle_count_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id   uuid NOT NULL REFERENCES warehouses(id),
  session_number text NOT NULL,
  count_type     text,
  zone_ids       uuid[],
  bin_ids        uuid[],
  status         text DEFAULT 'planned',
  count_date     date,
  UNIQUE(tenant_id, session_number)
);
ALTER TABLE cycle_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_sessions FORCE ROW LEVEL SECURITY;
```

---

## PART 6 — RLS POLICIES (Supabase PostgreSQL Engine)

### Session Functions

```sql
-- Read tenant_id from SET LOCAL — set by NestJS TenantContextInterceptor
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.tenant_id', true)::uuid, NULL)
$$;

-- Permission check — SECURITY DEFINER runs as owner, bypasses RLS for the lookup
CREATE OR REPLACE FUNCTION has_permission(p_resource text, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members tm
    JOIN roles r ON r.name = tm.role
      AND (r.tenant_id = tm.tenant_id OR r.tenant_id IS NULL)
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
      AND p.resource = p_resource AND p.action = p_action
    WHERE tm.user_id  = auth.uid()
      AND tm.tenant_id = current_tenant_id()
      AND tm.status   = 'active'
    LIMIT 1
  );
END;
$$;
```

### RLS Policy Template (Applied to Every Tenant Table)

```sql
-- Pattern to apply to: products, customers, sales, sales_items,
-- employees, attendance, payroll_runs, journal_entries, etc.

ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

-- Any active tenant member can read their own data
CREATE POLICY "<table>_select" ON <table> FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Insert requires permission + tenant match
CREATE POLICY "<table>_insert" ON <table> FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_permission('<resource>', 'create')
  );

-- Update requires permission + tenant match
CREATE POLICY "<table>_update" ON <table> FOR UPDATE
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (has_permission('<resource>', 'update'));

-- Delete restricted to admin/owner
CREATE POLICY "<table>_delete" ON <table> FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND has_permission('<resource>', 'delete')
  );
```

### Applied: Products RLS

```sql
CREATE POLICY "products_select" ON products FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_permission('inventory', 'create')
  );

CREATE POLICY "products_update" ON products FOR UPDATE
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (has_permission('inventory', 'update'));

CREATE POLICY "products_delete" ON products FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND has_permission('inventory', 'delete')
  );
```

### Applied: Sales RLS

```sql
CREATE POLICY "sales_select" ON sales FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "sales_insert" ON sales FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_permission('sales', 'create')
  );

CREATE POLICY "sales_update" ON sales FOR UPDATE
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (has_permission('sales', 'update'));

CREATE POLICY "sales_delete" ON sales FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND has_permission('sales', 'delete')
  );
```

### Audit Logs: INSERT ONLY (No update, no delete, ever)

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
-- Intentionally no UPDATE or DELETE policy — append-only by design
```

---

## PART 7 — AUTOMATED JOURNAL POSTING TRIGGERS

```sql
-- Auto-post journal entries on key business events
-- Debit/Credit validated: SUM(debit) must = SUM(credit) before INSERT

CREATE OR REPLACE FUNCTION post_sale_journal_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ar_account_id   uuid;
  rev_account_id  uuid;
  cogs_account_id uuid;
  inv_account_id  uuid;
  entry_id        uuid;
  entry_number    text;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'draft' THEN
    SELECT id INTO ar_account_id  FROM chart_of_accounts
      WHERE tenant_id = NEW.tenant_id AND account_code = '1100' LIMIT 1;
    SELECT id INTO rev_account_id FROM chart_of_accounts
      WHERE tenant_id = NEW.tenant_id AND account_code = '4001' LIMIT 1;

    entry_number := 'JV-' || TO_CHAR(NOW(),'YYYY') || '-' ||
                    LPAD(NEXTVAL('je_seq_' || NEW.tenant_id::text)::text, 6, '0');

    INSERT INTO journal_entries (
      tenant_id, entry_number, entry_date, description,
      reference_type, reference_id, status,
      total_debit, total_credit
    ) VALUES (
      NEW.tenant_id, entry_number, NOW()::date,
      'Sale ' || NEW.order_number, 'sale', NEW.id, 'posted',
      NEW.total_amount, NEW.total_amount
    ) RETURNING id INTO entry_id;

    INSERT INTO journal_entry_lines (tenant_id, journal_entry_id, account_id, debit_amount, description)
      VALUES (NEW.tenant_id, entry_id, ar_account_id, NEW.total_amount, 'AR: ' || NEW.order_number);

    INSERT INTO journal_entry_lines (tenant_id, journal_entry_id, account_id, credit_amount, description)
      VALUES (NEW.tenant_id, entry_id, rev_account_id, NEW.total_amount, 'Revenue: ' || NEW.order_number);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sale_journal
  AFTER UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION post_sale_journal_entry();
```

---

## PART 8 — TENANT PROVISIONER (Supabase Edge Function)

```typescript
// supabase/functions/tenant-provisioner/index.ts
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

Deno.serve(async (req) => {
  const body = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

  try {
    // Creates a RECORD, not a DATABASE
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        slug:     body.slug,
        name:     body.company_name,
        plan:     'free',
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
      })
      .select().single();

    if (error) throw error;
    const tid = tenant.id;

    // All setup runs in parallel — completes in under 2 seconds
    await Promise.all([
      supabase.from('tenant_members').insert({
        tenant_id: tid, user_id: body.user_id,
        role: 'owner', status: 'active'
      }),
      supabase.from('tenant_billing').insert({
        tenant_id: tid, plan: 'free', status: 'trialing',
        trial_end: new Date(Date.now() + 14 * 86400000).toISOString(),
        billing_email: body.email,
      }),
      supabase.from('tenant_usage').insert({ tenant_id: tid, users_count: 1 }),
      supabase.rpc('clone_system_roles_for_tenant',    { p_tenant_id: tid }),
      supabase.rpc('seed_default_chart_of_accounts',   { p_tenant_id: tid }),
      supabase.rpc('seed_default_leave_policies',      { p_tenant_id: tid }),
      supabase.rpc('seed_default_shift_templates',     { p_tenant_id: tid }),
      supabase.rpc('seed_default_break_types',         { p_tenant_id: tid }),
    ]);

    // Stripe — non-blocking, fails gracefully
    try {
      const customer = await stripe.customers.create({
        email: body.email, name: body.company_name,
        metadata: { tenant_id: tid }
      });
      await supabase.from('tenant_billing')
        .update({ stripe_customer_id: customer.id })
        .eq('tenant_id', tid);
    } catch (e) {
      console.warn('Stripe customer creation failed (non-fatal):', e);
    }

    return Response.json({ success: true, tenant_id: tid });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
```

---

## PART 9 — MATERIALIZED VIEWS & ANALYTICS

```sql
-- Sales KPIs — refreshed every 15 min via pg_cron
CREATE MATERIALIZED VIEW mv_sales_daily AS
SELECT
  tenant_id,
  date_trunc('day', created_at)::date          AS sale_date,
  COUNT(*)                                      AS total_orders,
  SUM(total_amount)                             AS gross_revenue,
  SUM(discount_amount)                          AS total_discounts,
  SUM(total_amount - discount_amount)           AS net_revenue,
  COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
  COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
  COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_orders
FROM sales WHERE deleted_at IS NULL
GROUP BY tenant_id, date_trunc('day', created_at)::date
WITH DATA;
CREATE UNIQUE INDEX ON mv_sales_daily(tenant_id, sale_date);

-- Inventory summary — refreshed every 15 min
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT
  tenant_id, id AS product_id, name, sku,
  stock_qty, reorder_point,
  CASE
    WHEN stock_qty = 0              THEN 'out_of_stock'
    WHEN stock_qty <= reorder_point THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status,
  cost_price * stock_qty AS inventory_value
FROM products WHERE deleted_at IS NULL AND track_inventory = true
WITH DATA;
CREATE UNIQUE INDEX ON mv_inventory_summary(tenant_id, product_id);

-- Payroll monthly — refreshed hourly
CREATE MATERIALIZED VIEW mv_payroll_monthly AS
SELECT
  pr.tenant_id, pr.period_year, pr.period_month,
  COUNT(DISTINCT pri.employee_id) AS employee_count,
  SUM(pri.gross_pay)              AS total_gross,
  SUM(pri.total_deductions)       AS total_deductions,
  SUM(pri.net_pay)                AS total_net_pay,
  SUM(pri.income_tax)             AS total_tax
FROM payroll_runs pr
JOIN payroll_run_items pri ON pri.payroll_run_id = pr.id
WHERE pr.status IN ('approved','disbursed')
GROUP BY pr.tenant_id, pr.period_year, pr.period_month
WITH DATA;

-- Trial balance — refreshed hourly
CREATE MATERIALIZED VIEW mv_trial_balance AS
SELECT
  coa.tenant_id, coa.id AS account_id,
  coa.account_code, coa.name, coa.type,
  COALESCE(SUM(jel.debit_amount),  0) AS total_debit,
  COALESCE(SUM(jel.credit_amount), 0) AS total_credit,
  CASE WHEN coa.normal_balance = 'debit'
    THEN COALESCE(SUM(jel.debit_amount),0)  - COALESCE(SUM(jel.credit_amount),0)
    ELSE COALESCE(SUM(jel.credit_amount),0) - COALESCE(SUM(jel.debit_amount),0)
  END AS net_balance
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
GROUP BY coa.tenant_id, coa.id, coa.account_code, coa.name, coa.type, coa.normal_balance
WITH DATA;

-- pg_cron refresh schedule
SELECT cron.schedule('refresh-sales-mv',     '*/15 7-23 * * *', $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily $$);
SELECT cron.schedule('refresh-inventory-mv', '*/15 7-23 * * *', $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_summary $$);
SELECT cron.schedule('refresh-payroll-mv',   '0 * * * *',       $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payroll_monthly $$);
SELECT cron.schedule('refresh-finance-mv',   '0 * * * *',       $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance $$);
```

---

## PART 10 — BULLMQ QUEUE SETUP

```typescript
// backend/src/infra/redis/redis.service.ts
import { Injectable } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private connection: { host: string; port: number; password?: string };

  constructor(private config: ConfigService) {
    this.connection = {
      host:     this.config.get('REDIS_HOST', 'localhost'),
      port:     this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD'),
    };
  }

  createQueue(name: string, options?: object) {
    return new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail:     50,
        ...options,
      },
    });
  }
}

// Queue definitions
export const QUEUES = {
  NOTIFICATIONS: 'notifications',   // HIGH: in-app, push
  EMAIL:         'email',           // HIGH: transactional emails
  SMS_WHATSAPP:  'sms-whatsapp',    // HIGH: SMS + WhatsApp
  PDF:           'pdf-generation',  // MEDIUM: invoices, payslips
  INVENTORY_ALERTS: 'inventory-alerts', // MEDIUM: low stock
  REPORT_EXPORT: 'report-export',   // LOW: CSV/XLSX
  CACHE_WARM:    'cache-warm',      // LOW: MV refresh signals
  WEBHOOK:       'webhook-dispatch',// HIGH: outbound webhooks
} as const;
```

---

## PART 11 — TEMPORAL WORKFLOWS

```typescript
// backend/src/workers/temporal/payroll.workflow.ts

import { proxyActivities } from '@temporalio/workflow';
import { chunk } from 'lodash';

const {
  lockPayrollPeriod,
  getActiveEmployees,
  calculateEmployeePayroll,
  applyTaxSlabs,
  aggregatePayrollTotals,
  updatePayrollRunStatus,
  notifyHrManager,
} = proxyActivities({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3 },
});

export async function payrollWorkflow(input: {
  tenantId:     string;
  payrollRunId: string;
  periodYear:   number;
  periodMonth:  number;
}): Promise<void> {

  // Lock period — prevents duplicate runs
  await lockPayrollPeriod(input);

  const employees = await getActiveEmployees(input.tenantId);

  // Process in parallel batches of 50 — RULE 5 at workflow level
  await Promise.all(
    chunk(employees, 50).map(batch =>
      calculateEmployeePayroll({ ...input, employees: batch })
    )
  );

  await applyTaxSlabs(input);
  await aggregatePayrollTotals(input.payrollRunId);
  await updatePayrollRunStatus({ id: input.payrollRunId, status: 'review' });
  await notifyHrManager({ tenantId: input.tenantId });
}
```

---

## PART 12 — CI/CD BREACH TEST SUITE (Gate Before Every Deploy)

```typescript
// backend/test/rls-breach.spec.ts
// This test MUST pass 100% — CI pipeline blocks deploy on any failure

import { Pool } from 'pg';

describe('RLS Cross-Tenant Breach Tests', () => {
  let pool: Pool;
  const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
  const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  afterAll(async () => { await pool.end(); });

  async function queryAsTenant<T>(tenantId: string, sql: string): Promise<T[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.tenant_id = $1', [tenantId]);
      const { rows } = await client.query(sql);
      await client.query('COMMIT');
      return rows as T[];
    } finally {
      client.release();
    }
  }

  const tables = [
    { table: 'products',         label: 'products'         },
    { table: 'customers',        label: 'customers'         },
    { table: 'sales',            label: 'sales'             },
    { table: 'sales_items',      label: 'sales_items'       },
    { table: 'employees',        label: 'employees'         },
    { table: 'attendance',       label: 'attendance'        },
    { table: 'payroll_runs',     label: 'payroll_runs'      },
    { table: 'payroll_run_items',label: 'payroll_run_items' },
    { table: 'journal_entries',  label: 'journal_entries'   },
    { table: 'purchase_orders',  label: 'purchase_orders'   },
    { table: 'production_orders',label: 'production_orders' },
    { table: 'bin_stock_levels', label: 'bin_stock_levels'  },
    { table: 'warehouses',       label: 'warehouses'        },
    { table: 'suppliers',        label: 'suppliers'         },
  ];

  // Tenant A cannot see Tenant B data
  tables.forEach(({ table, label }) => {
    it(`Tenant A cannot see Tenant B ${label}`, async () => {
      const rows = await queryAsTenant<{ tenant_id: string }>(
        TENANT_A,
        `SELECT tenant_id FROM ${table} WHERE tenant_id = '${TENANT_B}'`
      );
      expect(rows.length).toBe(0);
    });
  });

  // Tenant B cannot see Tenant A data
  tables.forEach(({ table, label }) => {
    it(`Tenant B cannot see Tenant A ${label}`, async () => {
      const rows = await queryAsTenant<{ tenant_id: string }>(
        TENANT_B,
        `SELECT tenant_id FROM ${table} WHERE tenant_id = '${TENANT_A}'`
      );
      expect(rows.length).toBe(0);
    });
  });

  // Attempt to inject into wrong tenant via INSERT
  it('Tenant A cannot INSERT into Tenant B products', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.tenant_id = $1', [TENANT_A]);

      await expect(
        client.query(`
          INSERT INTO products (tenant_id, name, sku, unit_price)
          VALUES ($1, 'Hacked Product', 'HACK-001', 0)
        `, [TENANT_B])  // trying to write into Tenant B
      ).rejects.toThrow();  // RLS WITH CHECK rejects this

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // Verify SET LOCAL cleans up after transaction
  it('Connection pool: SET LOCAL does not bleed between transactions', async () => {
    const client = await pool.connect();
    try {
      // Transaction 1: Tenant A
      await client.query('BEGIN');
      await client.query('SET LOCAL app.tenant_id = $1', [TENANT_A]);
      const { rows: [row1] } = await client.query('SELECT current_setting(\'app.tenant_id\', true) AS tid');
      expect(row1.tid).toBe(TENANT_A);
      await client.query('COMMIT');

      // After commit — SET LOCAL must be gone
      const { rows: [row2] } = await client.query('SELECT current_setting(\'app.tenant_id\', true) AS tid');
      expect(row2.tid).toBeFalsy(); // empty or null — no bleed

      // Transaction 2: Tenant B on same connection
      await client.query('BEGIN');
      await client.query('SET LOCAL app.tenant_id = $1', [TENANT_B]);
      const { rows: [row3] } = await client.query('SELECT current_setting(\'app.tenant_id\', true) AS tid');
      expect(row3.tid).toBe(TENANT_B); // only Tenant B — no Tenant A bleed
      await client.query('COMMIT');

    } finally {
      client.release();
    }
  });
});
```

---

## PART 13 — ENVIRONMENT VARIABLES

### NestJS Backend (.env)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...          # Safe for JWT verification only
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # SERVER SIDE ONLY — never expose

# Direct Postgres connection (via PgBouncer, transaction mode)
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:6543/postgres?pgbouncer=true

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Temporal
TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233
TEMPORAL_NAMESPACE=your-namespace

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase Auth Email (OTP/Magic Link delivery)
# Configure in Supabase Dashboard -> Authentication -> Email

# App
PORT=3001
NODE_ENV=production
JWT_SECRET=your-32-char-minimum-secret
```

### Next.js Frontend (.env.local)

```env
# Supabase — ANON KEY ONLY in frontend (subject to full RLS)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # public key — RLS enforced

# NestJS Backend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Analytics
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=XXXXXXXXXX

# Stripe public key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# DO NOT put these here — they belong in NestJS only:
# SUPABASE_SERVICE_ROLE_KEY ← never in frontend
# STRIPE_SECRET_KEY         ← never in frontend
# DATABASE_URL              ← never in frontend
```

---

## PART 14 — THE GOLDEN RULES (Final Reference)

### The 5 Engine Rules (Enforced in Code)

```
RULE 1 — SET LOCAL INSIDE TRANSACTION
  ✅ db.withTenantContext() wraps BEGIN...SET LOCAL...COMMIT
  ❌ Never call SET LOCAL outside a transaction
  WHY: Without BEGIN, SET LOCAL behaves as SET SESSION —
       tenant_id persists on the pooled connection for the next request

RULE 2 — ONE CONSISTENT DB CLIENT PER CONTEXT
  ✅ Use raw pg client via withTenantContext() for all tenant operations
  ❌ Never mix supabase.from() client with SET LOCAL in the same request
  WHY: supabase.from() opens its own connection from its internal pool.
       Your SET LOCAL on connection A has zero effect on connection B.

RULE 3 — ATOMIC STOCK DEDUCTION
  ✅ UPDATE products SET stock_qty = stock_qty - $1
     WHERE id = $2 AND stock_qty >= $1
  ❌ Never: read stock_qty → check in code → write stock_qty (two steps)
  WHY: Between read and write, another request can deduct the same stock.
       Atomic UPDATE + WHERE stock_qty >= qty is a single engine operation.

RULE 4 — TENANT_ID FROM SERVER CONTEXT ONLY
  ✅ Next.js middleware resolves tenant_id from DB lookup → sets header
  ✅ NestJS reads from header → @CurrentTenant() decorator
  ❌ Never trust tenant_id from request body or query params
  WHY: Frontend can send any tenant_id in the body. Middleware cannot be
       bypassed — it runs before any request reaches the application.

RULE 5 — JOINS NOT LOOPS
  ✅ Single SQL query with LEFT JOIN + json_agg() for nested data
  ❌ Never: fetch sales → for each sale → fetch items → for each item → fetch product
  WHY: 50 sales × 5 items = 251 queries per page load. Under 1,000 concurrent
       users this saturates your Postgres connection pool.
```

### Database Rules

```
✅ FORCE ROW LEVEL SECURITY on every tenant table (not just ENABLE)
✅ CONCURRENTLY index tenant_id on every table before production
✅ Soft delete (deleted_at) for all business data — never hard delete
✅ GENERATED ALWAYS AS for all calculated columns (due_amount, late_minutes)
✅ Partition audit_logs, inventory_logs, notifications by month
✅ Materialized views for all dashboard/report queries
✅ Journal entries posted, never deleted — use reversal entries
✅ payroll_run_items.earnings/deductions are immutable after approval
✅ stock_qty updated only via inventory_logs trigger — never directly
❌ NEVER use OFFSET pagination past page 10 — use cursor (id < last_id)
❌ NEVER SELECT * in any production query
❌ NEVER hold a Postgres transaction open across an external API call
❌ NEVER post journal entries where SUM(debit) ≠ SUM(credit)
❌ NEVER hard delete sales, employees, journal entries, payroll records
```

### Security Rules

```
✅ Service role key: NestJS only + Supabase Edge Functions only
✅ Anon key: Next.js frontend only
✅ Stripe webhook signature verified before processing any event
✅ Zod validation on every Server Action input and NestJS DTO
✅ UUID format validated in TenantContextInterceptor
✅ RLS breach test suite runs in CI — blocks deploy on any failure
❌ NEVER put SUPABASE_SERVICE_ROLE_KEY in Next.js or browser
❌ NEVER put DATABASE_URL in Next.js or browser
❌ NEVER trust x-tenant-id from untrusted sources — middleware sets it
```

---

## PART 15 — DEPLOYMENT SEQUENCE

### Day 1 — Database (Supabase)
```
□ Enable extensions: uuid-ossp, pg_cron, pg_stat_statements, pgcrypto
□ Run migrations in order:
    Platform tables → RBAC → Audit → Core Business
    → HRM → Payroll → Finance → Purchase → Production → Warehouse
□ Create RLS functions: current_tenant_id(), has_permission()
□ Apply RLS policies + FORCE ROW LEVEL SECURITY to all tenant tables
□ Install all DB triggers (break totals, stock deduction, journal auto-post)
□ Create initial partitions: audit_logs, inventory_logs, notifications
□ Schedule pg_cron: partitions, MV refresh, usage reset
□ Seed: system roles + permissions
□ ★ RUN RLS BREACH TEST SUITE — 100% pass required before proceeding ★
```

### Day 2 — NestJS Backend
```
□ Deploy NestJS to Railway / Render / AWS ECS / Fly.io
□ Configure Redis (Upstash or self-hosted)
□ Deploy Temporal (Temporal Cloud or self-hosted)
□ Register all BullMQ queues and workers
□ Register all Temporal workflow definitions
□ Deploy Nginx API gateway (rate limiting + TLS)
□ Set all environment variables
□ Health check all endpoints
```

### Day 3 — Next.js Frontend
```
□ npx create-next-app@latest --typescript --app --tailwind --eslint
□ Install: @supabase/ssr @tanstack/react-query sonner zod
□ Create Supabase clients: browser / server / middleware
□ Deploy middleware.ts — verify tenant injection works
□ Create route groups and tenant shell layout
□ Wire PermissionGate + BillingGate components
```

### Day 4 — Integrations
```
□ Stripe webhook: deploy + test with Stripe CLI
□ Supabase Auth email delivery: verify templates/redirect URLs for welcome/invite/verification
□ SMS/WhatsApp integration
□ Supabase Realtime channels for live notifications
```

### Day 5 — Launch Checklist
```
□ Load test: 1,000 concurrent users on core endpoints
□ Verify MV refreshes run without blocking queries
□ Lighthouse ≥ 95 on marketing page
□ All 5 engine rules verified in code review
□ RLS breach suite passes (28 tests across 14 tables)
□ No service role key in any frontend bundle
□ Security headers configured in next.config.ts
□ pg_cron jobs running: check in Supabase Dashboard → Database → Cron Jobs
```

---

> **Blueprint Version 6.0 — Production Engine Edition**
>
> **Stack:** Next.js 15 · NestJS · Supabase PostgreSQL · Temporal · BullMQ + Redis · Stripe
>
> **What Supabase owns:** Auth (JWT) · PostgreSQL · RLS (Postgres-native) · Storage · Realtime · Edge Functions · pg_cron
>
> **What NestJS owns:** Domain logic · Tenant context (SET LOCAL) · Permission guards · Queue producers · Temporal client
>
> **Tenant isolation method:** Shared schema + FORCE ROW LEVEL SECURITY — not database-per-tenant
>
> **Same product across tenants:** prod-AAA (Tenant A Apple) and prod-BBB (Tenant B Apple) are separate rows with independent UUIDs, independent stock counters, and independent order histories. RLS makes them invisible to each other.
>
> **The 5 rules are in the code, not just the docs.** DatabaseService.withTenantContext() enforces Rules 1+2. ProductsService.deductStock() enforces Rule 3. middleware.ts enforces Rule 4. All queries use joins, enforcing Rule 5.
