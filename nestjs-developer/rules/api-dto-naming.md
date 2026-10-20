---
title: Name and Structure DTOs Consistently
impact: MEDIUM
impactDescription: Any DTO's file and class name can be predicted from the route it serves
tags: api, dto, naming, params, queries, conventions
---

## Name and Structure DTOs Consistently

DTOs live in the module's `dtos/` folder (see `arch-feature-modules`). File names are kebab-case; class names are the PascalCase file name with the suffix shown.

| Kind | File | Class |
|---|---|---|
| Create body | `create-{resource}.dto.ts` | `CreateOrderDto` |
| Update body | `update-{resource}.dto.ts` | `UpdateOrderDto` |
| Action body | `{verb}-{resource}.dto.ts` (`cancel-order`, `ship-order`) | `CancelOrderDto` |
| Search body (`POST /{resources}/search`) | `search-{resources}.dto.ts` | `SearchOrdersDto` |
| Internal route body | `internal-{verb}-{resource}.dto.ts` | `InternalCreateOrderDto` |
| Route params | `{resource}-id.param.dto.ts`, named for the deepest resource (`order-item-id` for `/orders/:id/items/:itemId`) | `OrderIdParamDto`, `OrderItemIdParamDto` |
| Endpoint query | `{verb}-{resources}.query.dto.ts`; list endpoints use `find-all-{resources}` | `FindAllOrdersQueryDto` |
| Reusable query piece | `{concern}.query.dto.ts` (`pagination`, `sort`) | `PaginationQueryDto` |
| Response | `{resource}-response.dto.ts` | `OrderResponseDto` |
| Nested input shape | `{shape}.dto.ts` | `AddressDto` |

Rules behind the table:

- **Params use `.param.dto.ts`** (dot, like `.query.dto.ts`), never `-param.dto.ts`. Longer routes extend the shorter route's param DTO, so each parameter is declared once.
- **Queries start with a verb** when they belong to one endpoint. A piece reused by several queries is named for its concern, and endpoint queries extend it. List queries extend `PaginationQueryDto`.
- **Request bodies start with a verb** (`create-`, `update-`, `cancel-`, `search-`), never a `-request` suffix.
- **Responses end in `-response`**, never a bare noun (`order.dto.ts` reads like an input).
- **Nested input shapes** are named for the shape. A shape used by only one DTO lives in that DTO's file; a shape shared by several gets its own file (often under `shared/dtos/`).
- The Create DTO is the source of truth for editable fields; Update DTOs derive from it (see `api-use-mapped-types`).

**Incorrect (mixed separators, missing verbs, ambiguous nouns):**

```typescript
dtos/
├── order-id-param.dto.ts          // dash instead of .param
├── report.query.dto.ts            // one endpoint's query without a verb
├── checkout-request.dto.ts        // -request suffix instead of a verb
├── order.dto.ts                   // response named like an input
└── order-item-id-param.dto.ts     // dash again, and repeats the order id field instead of extending

// Each route re-declares the same params
export class OrderItemIdParamDto {
  @IsUUID() id: string;            // Duplicated from OrderIdParamDto
  @IsUUID() itemId: string;
}
```

**Correct (predictable names, params declared once):**

```typescript
order/dtos/
├── order-id.param.dto.ts
├── order-item-id.param.dto.ts
├── create-order.dto.ts            // contains OrderItemDto, used only here
├── update-order.dto.ts
├── cancel-order.dto.ts
├── search-orders.dto.ts           // POST /orders/search; contains its nested filter shapes
├── find-all-orders.query.dto.ts
├── export-orders.query.dto.ts
└── order-response.dto.ts

shared/dtos/
├── pagination.query.dto.ts
└── address.dto.ts                 // nested shape used by orders and users

// order-id.param.dto.ts - GET /orders/:id
export class OrderIdParamDto {
  @ApiProperty({ description: 'UUID of the order', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  id: string;
}

// order-item-id.param.dto.ts - GET /orders/:id/items/:itemId
export class OrderItemIdParamDto extends OrderIdParamDto {
  @ApiProperty({ description: 'UUID of the order item', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  itemId: string;
}

// shared/dtos/pagination.query.dto.ts - reusable piece
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of items to return', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Always cap the page size
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Number of items to skip from the start', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

// find-all-orders.query.dto.ts - endpoint query extends the reusable piece
export class FindAllOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only orders in this status', example: 'paid' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

// create-order.dto.ts - nested shape used only here stays in the file;
// the shared AddressDto is imported
export class OrderItemDto {
  @ApiProperty({ description: 'Stock keeping unit of the product', example: 'SKU-001' })
  @IsString()
  @MaxLength(64)
  sku: string;

  @ApiProperty({ description: 'Number of units', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Items in the order', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ description: 'Where the order is shipped', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;
}

// order-response.dto.ts
export class OrderResponseDto {
  @ApiProperty({ description: 'UUID of the order', example: '00000000-0000-0000-0000-000000000000' })
  id: string;

  @ApiProperty({ description: 'Current order status', example: 'paid' })
  status: OrderStatus;
}
```

**Search body (`POST /{resources}/search`, see `api-controller-conventions`):** used when the criteria do not fit a query string. It follows the same rules as any other body, plus:

- Pagination works exactly as for `GET` lists: the DTO extends `PaginationQueryDto`, so `limit` is capped the same way.
- Every criterion is optional, and every array is capped (`@ArrayMaxSize`) so one request cannot fan out into an unbounded query.
- Ranges are nested objects (`{ min, max }`, `{ from, to }`); nested shapes used only by this DTO stay in its file.
- Sort fields are whitelisted with `@IsIn`. The service maps them to columns and never interpolates a client string into SQL.

```typescript
// order/dtos/search-orders.dto.ts - body of POST /orders/search
export const ORDER_SORT_FIELDS = ['createdAt', 'total', 'status'] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export class OrderTotalRangeDto {
  @ApiPropertyOptional({ description: 'Minimum order total in cents, inclusive', example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @ApiPropertyOptional({ description: 'Maximum order total in cents, inclusive', example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  max?: number;
}

export class OrderDateRangeDto {
  @ApiPropertyOptional({ description: 'Start of the period, inclusive (ISO 8601)', example: '2026-01-15T10:30:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'End of the period, exclusive (ISO 8601)', example: '2026-02-15T10:30:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class OrderSortDto {
  @ApiProperty({ description: 'Field to sort by', example: 'createdAt' })
  @IsIn(ORDER_SORT_FIELDS)
  field: OrderSortField;

  @ApiProperty({ description: 'Sort direction', example: 'desc' })
  @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc';
}

export class SearchOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Match orders in any of these statuses', example: ['paid', 'shipped'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(OrderStatus, { each: true })
  statuses?: OrderStatus[];

  @ApiPropertyOptional({ description: 'Match orders containing any of these SKUs', example: ['SKU-001', 'SKU-002'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  skus?: string[];

  @ApiPropertyOptional({ description: 'Order total range', type: OrderTotalRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderTotalRangeDto)
  total?: OrderTotalRangeDto;

  @ApiPropertyOptional({ description: 'Creation date range', type: OrderDateRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderDateRangeDto)
  createdAt?: OrderDateRangeDto;

  @ApiPropertyOptional({ description: 'Sort order, applied in sequence', type: [OrderSortDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OrderSortDto)
  sort?: OrderSortDto[];
}

// order/services/order.service.ts - criteria become parameterized conditions,
// sort fields were already whitelisted by the DTO
async search(authUser: JwtUser, dto: SearchOrdersDto): Promise<PaginatedResult<Order>> {
  const query = this.orderRepository
    .createQueryBuilder('o')
    .where('o.userId = :userId', { userId: authUser.id });

  if (dto.statuses?.length) query.andWhere('o.status IN (:...statuses)', { statuses: dto.statuses });
  if (dto.skus?.length) query.innerJoin('o.items', 'item', 'item.sku IN (:...skus)', { skus: dto.skus });
  if (dto.total?.min !== undefined) query.andWhere('o.total >= :min', { min: dto.total.min });
  if (dto.total?.max !== undefined) query.andWhere('o.total <= :max', { max: dto.total.max });
  if (dto.createdAt?.from) query.andWhere('o.createdAt >= :from', { from: dto.createdAt.from });
  if (dto.createdAt?.to) query.andWhere('o.createdAt < :to', { to: dto.createdAt.to });

  for (const { field, direction } of dto.sort ?? [{ field: 'createdAt', direction: 'desc' }]) {
    query.addOrderBy(`o.${field}`, direction === 'asc' ? 'ASC' : 'DESC');
  }

  const [result, count] = await query.skip(dto.offset).take(dto.limit).getManyAndCount();
  return { result, count, limit: dto.limit, offset: dto.offset };
}
```

Reference: [NestJS Validation](https://docs.nestjs.com/techniques/validation)
