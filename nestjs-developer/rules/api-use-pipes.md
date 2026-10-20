---
title: Bind Params and Queries to DTO Classes
impact: MEDIUM
impactDescription: Pipes and DTOs ensure clean, validated data reaches your handlers
tags: api, pipes, validation, transformation, params
---

## Bind Params and Queries to DTO Classes

Bind `@Param()`, `@Query()` and `@Body()` to DTO classes and let the global `ValidationPipe` validate and transform them. Avoid inline parameter extraction (`@Param('id', ParseUUIDPipe) id: string`, `@Query('page') page: string`): every route then declares its parameters once, in a class that is validated, documented in Swagger, and reusable by longer routes through inheritance (see `api-dto-naming`).

Value conversions belong in the DTO too: `@Type(() => Number)` and `@Type(() => Date)` for numbers and dates, `@Transform` for anything else (splitting a comma-separated list, trimming). A custom `PipeTransform` is only for an argument that is not a DTO, which these conventions rarely have.

**Incorrect (manual parsing, or inline extraction per parameter):**

```typescript
@Controller('users')
export class UserController {
  // Manual validation in every handler
  @Get(':id')
  findById(@Param('id') id: string): Promise<User> {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    return this.userService.findById(id);
  }

  // Inline pipes: validation scattered over handlers, invisible to Swagger
  // descriptions, and repeated on every route that takes the same params
  @Get(':id/orders')
  findOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<Order[]> {
    return this.orderService.findByUser(id, limit, offset);
  }
}
```

**Correct (param and query DTOs, custom pipes for domain transformations):**

```typescript
// The global ValidationPipe is registered in configureApp() (see security-validate-all-input)

// user/dtos/user-id.param.dto.ts
export class UserIdParamDto {
  @ApiProperty({ description: 'UUID of the user', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  id: string;
}

// user/dtos/find-all-user-orders.query.dto.ts
export class FindAllUserOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only orders in this status', example: 'paid' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

@Controller('users')
export class UserController {
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }

  @Get(':id/orders')
  findAllOrders(
    @Param() params: UserIdParamDto,
    @Query() query: FindAllUserOrdersQueryDto,
  ): Promise<PaginatedResult<Order>> {
    return this.orderService.findAllByUser(params.id, query);
  }
}

// report/dtos/find-all-reports.query.dto.ts - conversions declared on the DTO
export class FindAllReportsQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Start of the period (ISO 8601)', example: '2026-01-15T10:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ description: 'End of the period (ISO 8601)', example: '2026-02-15T10:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  to: Date;

  // Comma-separated list to array
  @ApiPropertyOptional({ description: 'Comma-separated category keys', example: 'news,events' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  categories?: string[];
}
```

Reference: [NestJS Pipes](https://docs.nestjs.com/pipes) · [Validation](https://docs.nestjs.com/techniques/validation)
