import { Injectable } from "@nestjs/common";

import { TenantDbManager } from "../../infra/database/tenant-db.manager";

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly tenantDbManager: TenantDbManager) {}

  async resolveContext(input: { tenantSlug: string; userId: string }) {
    return this.tenantDbManager.resolveTenantContext(input);
  }
}
