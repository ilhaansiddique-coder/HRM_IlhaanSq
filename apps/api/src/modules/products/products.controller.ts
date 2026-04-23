import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { JwtGuard } from "../../common/guards/jwt.guard";
import {
  ProductsService,
  type ProductUpsertPayload,
  type ProductVariantsBulkUpsertPayload,
  type ProductVariantsClearPayload,
} from "./products.service";

@Controller("products")
@UseGuards(JwtGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async listProducts(@Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.productsService.listProducts(userId);
  }

  @Post("upsert")
  async upsertProduct(@Body() body: ProductUpsertPayload, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.productsService.upsertProduct({ userId, payload: body });
  }

  @Get(":productId/variants")
  async listProductVariants(@Param("productId") productId: string, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.productsService.listProductVariants({ userId, productId });
  }

  @Post("variants/bulk-upsert")
  async bulkUpsertVariants(@Body() body: ProductVariantsBulkUpsertPayload, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.productsService.bulkUpsertVariants({ userId, payload: body });
  }

  @Post("variants/clear")
  async clearVariants(@Body() body: ProductVariantsClearPayload, @Req() request: any) {
    const userId = String(request.userId ?? request.user?.id ?? "");
    return this.productsService.clearVariants({ userId, payload: body });
  }
}
