---
title: Use Global Guards for Authentication and Authorization
impact: HIGH
impactDescription: Every route is protected by default, and access rules are declared, not hand-coded
tags: security, guards, authentication, authorization
---

## Use Global Guards for Authentication and Authorization

Register two guards globally, in this order, as `APP_GUARD` providers in `AppModule`:

1. `JwtAuthGuard` (passport `AuthGuard('jwt')`, see `security-auth-jwt`): every route requires a valid token unless it is marked `@Public()`.
2. `RolesGuard`: a route or controller marked `@Roles(...)` requires one of those roles.

Routes are then protected by default; forgetting a decorator fails closed. Never check `request.user` or roles inside a handler, and never repeat `@UseGuards(JwtAuthGuard, RolesGuard)` on routes (the global guards already run; a second registration runs them twice).

- `@Public()` and `@Roles()` live in `shared/decorators/`, the guards in `auth/guards/`. Metadata keys are exported constants, never string literals repeated in two files.
- `RolesGuard` must handle a public route and a missing user without throwing a `TypeError`.
- Ownership ("is this the caller's order?") is a domain rule: the service scopes its query by `authUser.id` and answers 404 (see `arch-service-conventions`). Guards decide who may call a route, not which rows they see.

**Incorrect (manual checks in handlers):**

```typescript
@Controller('users')
export class UserController {
  @Delete(':id')
  async delete(@Req() req: AppRequest, @Param() params: UserIdParamDto): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    if (!req.user.roles.includes(Role.Admin)) {
      throw new ForbiddenException(); // Repeated in every handler, forgotten in the next one
    }
    return this.userService.delete(params.id);
  }
}
```

**Correct (global guards, declarative decorators):**

```typescript
// shared/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// shared/decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }
}

// auth/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AppRequest>().user;
    return !!user && requiredRoles.some((role) => user.roles.includes(role));
  }
}

// app.module.ts - order matters: authentication first, then roles
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

// user/controllers/user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id); // Any authenticated caller
  }

  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  delete(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.delete(params.id); // Admins only
  }
}
```

Reference: [NestJS Guards](https://docs.nestjs.com/guards) · [Enable authentication globally](https://docs.nestjs.com/security/authentication#enable-authentication-globally)
