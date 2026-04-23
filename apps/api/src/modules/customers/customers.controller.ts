import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import { JwtGuard } from "../../common/guards/jwt.guard";
import { CustomersService, type CustomerUpsertPayload } from "./customers.service";

@Controller("customers")
@UseGuards(JwtGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post("upsert")
  async upsertCustomer(@Body() body: CustomerUpsertPayload, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.customersService.upsertCustomer({ userId, payload: body });
  }
}
