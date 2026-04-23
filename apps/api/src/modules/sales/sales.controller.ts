import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import { JwtGuard } from "../../common/guards/jwt.guard";
import {
  SalesService,
  type SaleCreatePayload,
  type SaleStatusUpdatePayload,
} from "./sales.service";

type AuthenticatedRequest = {
  userId?: string;
  user?: {
    id?: string;
  };
};

@Controller("sales")
@UseGuards(JwtGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post("create")
  async createSale(@Body() body: SaleCreatePayload, @Req() request: AuthenticatedRequest) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.salesService.createSale({ userId, payload: body });
  }

  @Post("status-update")
  async updateSaleStatus(@Body() body: SaleStatusUpdatePayload, @Req() request: AuthenticatedRequest) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.salesService.updateSaleStatus({ userId, payload: body });
  }
}
