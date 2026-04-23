import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";

import { JwtGuard } from "../../common/guards/jwt.guard";
import { PlatformTenantsService } from "./platform-tenants.service";

@Controller("platform/tenants")
@UseGuards(JwtGuard)
export class PlatformTenantsController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Get(":tenantSlug/context")
  async getTenantContext(@Param("tenantSlug") tenantSlug: string, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");

    return this.platformTenantsService.resolveContext({
      tenantSlug,
      userId,
    });
  }
}
