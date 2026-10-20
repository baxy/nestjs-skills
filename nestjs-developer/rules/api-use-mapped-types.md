---
title: Derive DTOs with Mapped Types
impact: MEDIUM
impactDescription: Keeps Create/Update/Response DTOs in sync and their validation rules consistent
tags: api, dto, mapped-types, validation
---

## Derive DTOs with Mapped Types

Use separate DTOs per operation (`CreateXDto`, `UpdateXDto`, `XResponseDto`), but derive them from each other with `PartialType`, `PickType`, `OmitType` and `IntersectionType` instead of copying fields. Copied DTOs drift: a field gets a new validator in one place and not the other, and update endpoints silently accept data that create rejects. Mapped types copy both the properties and their `class-validator`/`class-transformer` decorators.

Import mapped types from `@nestjs/swagger` when the project uses Swagger (so the derived DTOs keep their OpenAPI metadata), otherwise from `@nestjs/mapped-types`.

**Incorrect (hand-copied DTOs that drift apart):**

```typescript
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;
}

// Copied by hand - MaxLength was forgotten, password can be changed here
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string; // Password changes should go through a dedicated flow
}

// One DTO reused for everything - client can set server-owned fields
@Patch(':id')
update(@Param() params: UserIdParamDto, @Body() dto: User) {
  return this.userService.update(params.id, dto); // dto.role, dto.id accepted!
}
```

**Correct (derive DTOs from a single source of truth):**

```typescript
// Use '@nestjs/mapped-types' if the project doesn't use Swagger
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';

// user/dtos/create-user.dto.ts - the source of truth for editable fields
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) // Login looks emails up lowercased
  email: string;

  @ApiProperty({ description: 'Initial password, 12 to 128 characters', example: 'correct-horse-battery' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: 'UUID of the team the user joins', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}

// user/dtos/update-user.dto.ts - all fields optional, validators and docs kept;
// fields that must not change after creation are omitted first (as const is required)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'teamId'] as const),
) {}

// user/dtos/change-password.dto.ts - dedicated DTO for a dedicated flow
export class ChangePasswordDto extends PickType(CreateUserDto, ['password'] as const) {
  @ApiProperty({ description: 'The current password', example: 'old-horse-battery' })
  @IsString()
  @MaxLength(128)
  currentPassword: string;
}

// user/dtos/find-all-users.query.dto.ts - pagination (shared/dtos/pagination.query.dto.ts,
// see api-dto-naming) combined with optional filters taken from the Create DTO
export class FindAllUsersQueryDto extends IntersectionType(
  PaginationQueryDto,
  PickType(PartialType(CreateUserDto), ['name', 'email'] as const),
) {}

@Controller('users')
export class UserController {
  @Patch(':id')
  update(@Param() params: UserIdParamDto, @Body() dto: UpdateUserDto): Promise<User> {
    return this.userService.update(params.id, dto);
  }

  @Get()
  findAll(@Query() query: FindAllUsersQueryDto): Promise<PaginatedResult<User>> {
    return this.userService.findAll(query);
  }
}
```

Never re-declare a Create DTO's fields in its Update DTO: if `name` or `email` appear in both files, use `PartialType` instead.

Reference: [NestJS Mapped Types](https://docs.nestjs.com/techniques/validation#mapped-types)
