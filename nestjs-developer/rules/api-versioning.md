---
title: Version Breaking Changes with Nest's URI Versioning
impact: MEDIUM
impactDescription: Existing clients keep working while a new contract ships next to the old one
tags: api, versioning, breaking-changes, compatibility
---

## Version Breaking Changes with Nest's URI Versioning

Add a version only for a **breaking** change (a removed or renamed field, a changed type or meaning). Additive changes (a new optional field, a new endpoint) ship unversioned.

- Use Nest's built-in versioning with one strategy for the whole API: URI versioning (`/v1/users`), enabled in `configureApp()` with `defaultVersion: '1'`, so e2e tests call the same paths as clients (see `test-use-testing-module`). Do not hand-write `v1/` into controller paths, and do not mix strategies.
- A new version gets its own controller next to the old one (`UserV2Controller` in `controllers/user-v2.controller.ts`) and its own response DTOs (`user-v2-response.dto.ts`). Services stay version-agnostic: versions differ in the controller and the response DTO, never in an `if (version === ...)` in a service.
- A route that did not change stays in the old controller and lists both versions with `@Version(['1', '2'])` on its handler, so `/v2/...` still reaches it. A route declared for neither version returns 404 under `/v2`.
- Routes that are not part of the client contract are `VERSION_NEUTRAL`: health probes (see `micro-use-health-checks`) and webhooks keep one stable path.
- Mark a version as deprecated with `Deprecation`, `Sunset` (the announced removal date) and `Link` headers, set with `@Header()` so they work on both adapters (see `api-platform-agnostic`).

**Incorrect (breaking change in place, versions in paths and services):**

```typescript
@Controller('users')
export class UserController {
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id); // `name` was split into firstName/lastName: old clients break
  }
}

@Controller('v2/users') // Hand-written version segment
export class UsersV2Controller {
  @Get(':id')
  findById(@Param() params: UserIdParamDto, @Headers('X-API-Version') version: string) {
    return this.userService.findById(params.id, version); // Service branches on the API version
  }
}
```

**Correct (one strategy, a controller and response DTO per version):**

```typescript
// src/configure-app.ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

// user/controllers/user.controller.ts - version 1, unchanged
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @SerializeOptions({ type: UserV1ResponseDto, excludeExtraneousValues: true })
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }

  @Version(['1', '2']) // Unchanged in v2: one handler serves /v1 and /v2
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  delete(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.delete(params.id);
  }
}

// user/controllers/user-v2.controller.ts - version 2, same service
@Controller({ path: 'users', version: '2' })
export class UserV2Controller {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @SerializeOptions({ type: UserV2ResponseDto, excludeExtraneousValues: true })
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }
}

// user/dtos/user-v1-response.dto.ts - the old contract, derived from the same entity
export class UserV1ResponseDto {
  @ApiProperty({ description: 'UUID of the user', example: '00000000-0000-0000-0000-000000000000' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  name: string;
}

// shared/decorators/deprecated.decorator.ts - static headers, so @Header works on both adapters
export function Deprecated(sunset: string, successor: string) {
  return applyDecorators(
    Header('Deprecation', 'true'),
    Header('Sunset', sunset), // Announced removal date, as an HTTP date
    Header('Link', `<${successor}>; rel="successor-version"`),
  );
}

// On each v1 handler once v2 ships; its @ApiOperation also gets `deprecated: true`
@Deprecated('Wed, 30 Jun 2027 00:00:00 GMT', '/api/v2/users/{id}')
@Get(':id')
findById(@Param() params: UserIdParamDto): Promise<User> { /* ... */ }
```

Reference: [NestJS Versioning](https://docs.nestjs.com/techniques/versioning) · [RFC 8594 Sunset header](https://www.rfc-editor.org/rfc/rfc8594)
