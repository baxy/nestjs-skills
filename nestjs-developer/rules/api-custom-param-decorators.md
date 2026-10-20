---
title: Read the Caller with @AuthUser() and Compose Repeated Decorators
impact: MEDIUM
impactDescription: Typed, adapter-independent access to the caller without touching the request object
tags: api, decorators, request-context, auth
---

## Read the Caller with @AuthUser() and Compose Repeated Decorators

Handlers never reach into `@Req()` for request context. The authenticated caller comes from the `@AuthUser()` param decorator, typed as `JwtUser` (see `security-auth-jwt`), and is always the first handler parameter, named `authUser` (see `api-controller-conventions`). Other request context gets its own param decorator built with `createParamDecorator`.

Use `applyDecorators` to bundle decorators that always go together into one. Guards are global (see `security-use-guards`), so a composed decorator carries metadata and Swagger decorators, never `UseGuards`.

**Incorrect (raw request access, copy-pasted decorator stacks):**

```typescript
@Controller('orders')
export class OrderController {
  @Get()
  findAll(@Req() req: Request) {
    const userId = (req as any).user?.sub; // Untyped, Express-specific, wrong field name
    return this.orderService.findAll(userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard) // Already global: runs twice
  @Roles(Role.Admin)
  @ApiForbiddenResponse({ description: 'Caller is not an administrator' })
  delete(@Param() params: OrderIdParamDto) {
    return this.orderService.delete(params.id); // Same stack copy-pasted on every admin route
  }
}
```

**Correct (typed caller, composed decorators):**

```typescript
// shared/decorators/auth-user.decorator.ts
export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
  return ctx.switchToHttp().getRequest<AppRequest>().user;
});

// shared/decorators/admin-only.decorator.ts
export function AdminOnly() {
  return applyDecorators(
    Roles(Role.Admin),
    ApiForbiddenResponse({ description: 'Caller is not an administrator' }),
  );
}

// order/controllers/order.controller.ts
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@AuthUser() authUser: JwtUser, @Query() query: FindAllOrdersQueryDto): Promise<PaginatedResult<Order>> {
    return this.orderService.findAll(authUser, query);
  }

  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  delete(@Param() params: OrderIdParamDto): Promise<void> {
    return this.orderService.delete(params.id);
  }
}
```

Custom param decorators are not validated by the global `ValidationPipe` unless you set `validateCustomDecorators: true`. Only enable it if the decorator returns client-controlled data; `JwtUser` comes from a verified token and needs no validation.

Reference: [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
