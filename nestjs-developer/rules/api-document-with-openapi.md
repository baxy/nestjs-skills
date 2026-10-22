---
title: Document APIs with OpenAPI
impact: MEDIUM
impactDescription: Generated, always-current API contract for clients and reviewers
tags: api, openapi, swagger, documentation
---

## Document APIs with OpenAPI

Generate API documentation from the code with `@nestjs/swagger` and its CLI plugin (which infers `type`, `required`, `format` and `enum` from `class-validator` decorators). On top of that:

- **Every DTO field** (create, update, query, param) has `@ApiProperty` (required) or `@ApiPropertyOptional` (declared with `?` or `@IsOptional()`), each with a `description` and an `example`. A field typed as a nested DTO (`type: AddressDto`, `type: [OrderItemDto]`) has no `example` of its own: Swagger builds it from the nested DTO's field examples. The CLI plugin runs only in the nest CLI build, not in the test runner, so explicit decorators are the only way the documentation is the same in both.
- **Never duplicate validator information** in `@ApiProperty`: no `type`, `required`, `format` or `enum` when a validator already says it.
- **Every controller** has exactly one `@ApiTags(...)` named after the resource, plus its security decorator (for example `@ApiBearerAuth('bearer')`). Do not document dev-only auth schemes.
- **Every endpoint** has `@ApiOperation` with both `summary` and `description`.
- **Success responses are documented inside the envelope.** Every JSON body is wrapped as `{ success, statusCode, data }` (see `api-use-interceptors`), so a plain `@ApiOkResponse({ type: X })` documents the wrong shape. Use `@ApiEnvelopedResponse(X)` for one object or an array (`isArray: true`) and `@ApiPaginatedResponse(X)` for a paginated list, both in `src/shared/swagger/`. They are recommended when the endpoint returns a response DTO (see `api-use-dto-serialization`), not required otherwise; a documented success response always uses one of the two.
- Error responses specific to the endpoint are recommended too, each with a description of when it happens: `@ApiNotFoundResponse` for a missing resource, `@ApiConflictResponse` for a duplicate, `@ApiBadRequestResponse` for a broken domain rule, `@ApiForbiddenResponse` for a role check.
- Expose the spec in every environment where clients need it; do not hide it behind `NODE_ENV`.

Example values:

- UUIDs always use the nil UUID `00000000-0000-0000-0000-000000000000`. Realistic-looking UUIDs mislead and can be mistaken for real data.
- Dates use a clearly fictional, valid ISO 8601 timestamp such as `2026-01-15T10:30:00.000Z`.
- Other examples are realistic and self-explanatory (`'Jane Doe'`, `'Leave at the front door'`), never placeholders like `'string'` or `123`.

Formatting:

- Split a long `description` with string concatenation (`'...' +`), never template literals, which keep the newlines and render them in Swagger UI.
- Do not set `servers` in the `DocumentBuilder` when the app uses a global prefix: paths already include the prefix, and a `servers` entry double-prefixes requests in "Try it out".

**Incorrect (undocumented fields, duplicated validator info, placeholders):**

```typescript
export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]; // No @ApiProperty - undocumented when tests build the spec

  @ApiProperty({ type: 'string', required: true, example: 'string' }) // Duplicates the validator, placeholder example
  @IsString()
  note: string;

  @ApiProperty({ example: '3f9c8d21-4e5a-4b6c-9d7e-8f0a1b2c3d4e' }) // Realistic-looking UUID
  @IsOptional()
  @IsUUID()
  addressId?: string; // Optional, but documented as required
}

@Controller('orders') // No @ApiTags, no security decorator
export class OrderController {
  @ApiOperation({
    summary: 'Create an order',
    description: `Creates a new order.
      The order starts as pending.`, // Template literal: newlines show in the UI
  })
  @Post()
  create(@Body() dto: CreateOrderDto) { /* ... */ }

  @ApiOkResponse({ type: [OrderSummaryResponseDto] }) // Documents a bare array; the body is the paginated envelope
  @Get()
  findAll(@Query() query: FindAllOrdersQueryDto) { /* ... */ }
}
```

**Correct (explicit, described fields and fully decorated controllers):**

```typescript
// main.ts
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Orders API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build(), // No servers: the global prefix is already in every path
);
SwaggerModule.setup('api/docs', app, document);

// order/dtos/create-order.dto.ts
export class CreateOrderDto {
  @ApiProperty({ description: 'Items in the order, at least one', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ description: 'Delivery instructions for the courier', example: 'Leave at the front door' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description: 'UUID of a saved address; the default address is used when omitted',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;
}

// order/controllers/order.controller.ts
@ApiTags('Orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrderController {
  @ApiOperation({
    summary: 'Create an order',
    description:
      'Creates a new order for the authenticated user. The order starts as pending and is ' +
      'confirmed once the payment is authorized. Prices are taken from the catalog at the time ' +
      'of the request, not from the client.',
  })
  @Post()
  create(@AuthUser() authUser: JwtUser, @Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(authUser, dto);
  }

  @ApiOperation({
    summary: 'Get an order',
    description: 'Returns one of the authenticated user\'s orders with its items.',
  })
  @ApiNotFoundResponse({ description: 'Order does not exist or belongs to another user' })
  @Get(':id')
  findById(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto): Promise<Order> {
    return this.orderService.findById(authUser, params.id);
  }

  @ApiOperation({
    summary: 'List orders',
    description: 'Returns the authenticated user\'s orders, newest first, one page at a time.',
  })
  @ApiPaginatedResponse(OrderSummaryResponseDto, 'One page of orders')
  @Get()
  findAll(
    @AuthUser() authUser: JwtUser,
    @Query() query: FindAllOrdersQueryDto,
  ): Promise<PaginatedResult<OrderSummaryResponseDto>> {
    return this.orderService.findAll(authUser, query);
  }
}

// shared/swagger/api-enveloped-response.decorator.ts - the success envelope around one object or an array
export interface ApiEnvelopedResponseOptions {
  description: string;
  status?: HttpStatus;
  isArray?: boolean;
}

export function ApiEnvelopedResponse(model: Type<unknown>, options: ApiEnvelopedResponseOptions) {
  const status = options.status ?? HttpStatus.OK;
  const item = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model), // getSchemaPath only resolves models registered with the document
    ApiResponse({
      status,
      description: options.description,
      schema: {
        type: 'object',
        required: ['success', 'statusCode', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: status },
          data: options.isArray ? { type: 'array', items: item } : item,
        },
      },
    }),
  );
}

// shared/swagger/api-paginated-response.decorator.ts - data plus meta, as the envelope builds it from PaginatedResult
export function ApiPaginatedResponse(model: Type<unknown>, description: string) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['success', 'statusCode', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            required: ['totalCount', 'limit', 'offset'],
            properties: {
              totalCount: { type: 'integer', description: 'Rows matching the query across all pages', example: 42 },
              limit: { type: 'integer', description: 'Page size', example: 20 },
              offset: { type: 'integer', description: 'Rows skipped before this page', example: 0 },
            },
          },
        },
      },
    }),
  );
}
```

```jsonc
// nest-cli.json - the plugin still infers types and required-ness for the build
{
  "compilerOptions": {
    "plugins": [{ "name": "@nestjs/swagger", "options": { "introspectComments": true } }]
  }
}
```

Reference: [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction) · [CLI plugin](https://docs.nestjs.com/openapi/cli-plugin)
