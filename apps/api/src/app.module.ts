import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { JwtGuard } from "./common/guards/jwt.guard";
import { PublicGuard } from "./common/guards/public.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { envSchema } from "./infra/config/env";
import { PlatformDbService } from "./infra/database/platform-db.service";
import { TenantDbManager } from "./infra/database/tenant-db.manager";
import { SupabaseAuthService } from "./modules/auth/supabase-auth.service";
import { CustomersController } from "./modules/customers/customers.controller";
import { CustomersService } from "./modules/customers/customers.service";
import { HealthController } from "./modules/health/health.controller";
import { PlatformSuperAdminController } from "./modules/platform-super-admin/platform-super-admin.controller";
import { PlatformSuperAdminService } from "./modules/platform-super-admin/platform-super-admin.service";
import { PlatformTenantsController } from "./modules/platform-tenants/platform-tenants.controller";
import { PlatformTenantsService } from "./modules/platform-tenants/platform-tenants.service";
import { ProductsController } from "./modules/products/products.controller";
import { ProductsService } from "./modules/products/products.service";
import { ReportsController } from "./modules/reports/reports.controller";
import { ReportsService } from "./modules/reports/reports.service";
import { SalesController } from "./modules/sales/sales.controller";
import { SalesService } from "./modules/sales/sales.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
  controllers: [
    HealthController,
    PlatformTenantsController,
    PlatformSuperAdminController,
    CustomersController,
    ProductsController,
    ReportsController,
    SalesController,
  ],
  providers: [
    PublicGuard,
    JwtGuard,
    RolesGuard,
    CustomersService,
    ProductsService,
    ReportsService,
    SalesService,
    PlatformDbService,
    TenantDbManager,
    SupabaseAuthService,
    PlatformTenantsService,
    PlatformSuperAdminService,
  ],
})
export class AppModule {}
