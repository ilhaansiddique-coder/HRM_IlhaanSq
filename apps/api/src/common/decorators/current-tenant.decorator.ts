import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantId ?? null;
});

export const CurrentTenantRegistry = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenantRegistry ?? null;
});
