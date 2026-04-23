import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "api",
      environment: this.configService.get<string>("NODE_ENV") ?? "development",
      timestamp: new Date().toISOString(),
    };
  }
}
