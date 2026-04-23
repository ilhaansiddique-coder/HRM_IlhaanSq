import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtGuard } from "../../common/guards/jwt.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlatformSuperAdminService } from "./platform-super-admin.service";

@Controller("platform/super-admin")
@UseGuards(JwtGuard, RolesGuard)
@Roles("superadmin")
export class PlatformSuperAdminController {
  constructor(private readonly platformSuperAdminService: PlatformSuperAdminService) {}

  @Get("overview")
  async getOverview() {
    return this.platformSuperAdminService.getOverview();
  }

  @Get("tenants")
  async getTenantMetrics() {
    return this.platformSuperAdminService.listTenantMetrics();
  }

  @Get("tenants/:tenantId")
  async getTenantDetail(@Param("tenantId") tenantId: string) {
    return this.platformSuperAdminService.getTenantDetail(tenantId);
  }
}

