---
title: Validate All Input with DTOs and the Global ValidationPipe
impact: HIGH
impactDescription: First line of defense: nothing unvalidated reaches a service
tags: security, validation, dto, pipes
---

## Validate All Input with DTOs and the Global ValidationPipe

Every request body, query string and route parameter is bound to a DTO class with `class-validator` decorators and checked by one global `ValidationPipe`, registered in `configureApp()` with the shared `VALIDATION_PIPE_OPTIONS` (see `test-use-testing-module`):

- `whitelist: true` strips properties without decorators; `forbidNonWhitelisted: true` rejects them with a 400 instead, so a client sending `role` or `status` learns it is not accepted.
- `forbidUnknownValues: true` rejects an object that has no validation metadata. Nest's `ValidationPipe` defaults it to `false`, and then a nested object whose `@Type` was forgotten passes without being validated. A request DTO therefore needs at least one validator.
- `transform: true` returns DTO instances. Convert query and form values explicitly with `@Type(() => Number)` / `@Type(() => Date)`; do not turn on `enableImplicitConversion`, which converts `'false'` to `true`.
- Nested objects and arrays need `@ValidateNested()` **and** `@Type(() => Child)`. Without both, the nested payload is not validated at all.
- Every string has a `@MaxLength`, every array an `@ArrayMaxSize`, every page size a `@Max` (see `api-dto-naming`).
- Ids use `@IsUUID()` (any version), so the nil UUID used in documentation examples (see `api-document-with-openapi`) passes "Try it out".
- Passwords: `@MinLength(12)` and `@MaxLength(128)`; length beats composition rules. Never `@Transform` a password, and hash it before it reaches an entity (see `security-hash-passwords`).

**Incorrect (raw input, undecorated DTOs):**

```typescript
@Controller('users')
export class UserController {
  @Post()
  create(@Body() body: any) {
    return this.userService.create(body); // Anything reaches the service
  }

  @Get()
  findAll(@Query() query: any) {
    return this.userService.findAll(query.limit); // A string, possibly "-1" or "abc"
  }
}

export class CreateUserDto {
  name: string;  // No decorators: whitelist strips it, or without whitelist anything passes
  email: string;
}
```

**Correct (validated DTOs, one global pipe):**

```typescript
// user/dtos/create-user.dto.ts
export class CreateUserDto {
  @ApiProperty({ description: 'Display name', example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({ description: 'Login email address', example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ description: 'Initial password, 12 to 128 characters', example: 'correct-horse-battery' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}

// user/dtos/find-all-users.query.dto.ts - pagination comes from the shared PaginationQueryDto
export class FindAllUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches the start of the name or email', example: 'jane' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// user/dtos/user-id.param.dto.ts
export class UserIdParamDto {
  @ApiProperty({ description: 'UUID of the user', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  id: string;
}

// order/dtos/create-order.dto.ts - nested objects and arrays
export class CreateOrderDto {
  @ApiProperty({ description: 'Where the order is shipped', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiProperty({ description: 'Items in the order, 1 to 50', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

// user/controllers/user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindAllUsersQueryDto): Promise<PaginatedResult<User>> {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }
}
```

Queries built from validated values still use parameters (`where('user.email = :email', { email })`), never string concatenation.

Reference: [NestJS Validation](https://docs.nestjs.com/techniques/validation)
