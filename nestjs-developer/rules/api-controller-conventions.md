---
title: Follow Controller and REST Conventions
impact: MEDIUM-HIGH
impactDescription: Every controller reads the same way, and every endpoint follows predictable REST semantics
tags: api, controllers, rest, http, routes, naming, conventions
---

## Follow Controller and REST Conventions

Controllers are thin: they bind and validate input, delegate to the service, and return its result. All business logic and domain validation live in services (see `arch-service-conventions`). In NestJS every REST decision is made in the controller (the path in `@Controller`, the method decorator, `@HttpCode`), so the REST rules live here too.

### Naming

- The controller class and file are **singular**: `OrderController` in `order/controllers/order.controller.ts` (see `arch-resource-naming`). More controllers in a module carry the module name too: `OrderItemController`.
- The route path is **plural**, lowercase kebab-case: `@Controller('orders')`, `@Controller('orders/:id/items')`, `@Controller('payment-methods')`.

### URLs

- Collections are plural nouns; an item is the collection plus its id: `/orders`, `/orders/:id`.
- Sub-resources nest under their parent: `/orders/:id/items/:itemId`. The resource's own id is `:id`; ids below it are `:{child}Id`. A nested route must verify the child belongs to the parent and return 404 if it does not.
- **At most 4 collections deep**, counting the root: `/orders/:id/items/:itemId/adjustments/:adjustmentId/notes` is the limit. Anything deeper becomes a top-level collection filtered by its parent (`GET /notes?adjustmentId=...`).
- Filtering, sorting and pagination are query parameters, never path segments: `GET /orders?status=paid&sort=-createdAt&limit=20`, not `/orders/paid`.
- No trailing slashes, no file extensions, no verbs, except action segments on `POST` (below) and `download` on `GET`.
- Authentication flows are resources too: `POST /sessions` logs in, `DELETE /sessions/current` logs out, `POST /password-resets` starts a reset. No `/auth/login` or `/forgot-password`.

### HTTP methods

| Method | Use for | Success status |
|---|---|---|
| `GET` | Read a collection or an item. Always safe: no side effects, whatever the last segment says. | 200 |
| `POST /{resources}` | Create with a **server-assigned id**; repeating the request creates another resource. | 201 with the created resource; 202 when the work behind it is queued (see `micro-use-queues`) |
| `POST /{resources}/:id/{verb}` | Run an **action**: a command with business rules or side effects that is not a plain field change (`cancel`, `ship`, `refund`). Body only when the action has inputs (`{ reason }`); no body otherwise. | 200 with the updated resource, 202 if processed asynchronously, 204 if nothing to return |
| `POST /{resources}/search` | Search whose criteria do not fit a query string (too long, nested, or sensitive). No side effects; document it. Prefer `GET` with query parameters otherwise. | 200 |
| `PUT` | **Idempotent** create-or-replace at a known target: full replacement, upsert, or "ensure exists". | 201 when created; 200 when replaced or already present, or a documented error (typically 409) when the business rule rejects a repeat |
| `PATCH /{resources}/:id` | Partial update of plain fields. State transitions go through actions instead. | 200 with the updated resource |
| `DELETE /{resources}/:id` | Delete (or soft-delete). Idempotent. | 204 |

**Choosing between `POST` and `PUT` for creation** - ask: if the client sends the same request twice, does the server end up with one thing or two?

- **Two** (a new id each time): `POST`. `POST /orders` creates a second order.
- **One** (create or replace at a known target, or make sure something exists): `PUT` is allowed. `PUT /users/:id/avatar`, `PUT /orders/:id/shipping-address`, `PUT /documents/:id/versions` when it creates the one draft version and a repeat does not create another.
- **Idempotent means no second resource, not an identical response.** HTTP defines idempotency by the effect on the server (RFC 9110), so a repeated creating `PUT` must never create another resource. What the repeat *returns* is a business decision; document it on the endpoint:
  - **Return the existing resource (200)** when a repeat is harmless: "make sure the avatar exists", or a client retrying after a timeout.
  - **Return an error (typically 409 Conflict)** when the caller needs to know the resource already existed: creating a draft version while one is already open, so the client decides whether to continue the existing draft.
- When the created thing has a stable name, prefer a URL that names it (`PUT /documents/:id/versions/draft`); a `PUT` on a collection URL reads like "replace the whole collection" to generic HTTP clients.

**Downloads**: `GET /{resources}/:id` returns metadata and `GET /{resources}/:id/download` returns the content, with `Content-Disposition: attachment` or a redirect to a presigned URL. It is still a safe `GET`: recording an audit entry is fine, changing state is not.

**Error statuses**: 400 invalid input or a broken domain rule (such as an illegal state transition), 401 unauthenticated, 403 not allowed, 404 missing (or not visible to the caller), 409 the request clashes with existing data (a duplicate, a concurrent change).

### Handlers

- **Handler names**: `findAll`, `findById`, `findAll{SubResources}` (`findAllItems`), `create`, `update` (PATCH), `replace` (PUT replacement), `upsert` or `create{Thing}` (idempotent PUT creation), `delete`, `search`, `download`, and the action's verb (`cancel`, `ship`). A handler for a singular sub-resource of the item adds its name: `update{Thing}` (PATCH `/:id/profile`), `replace{Thing}` (PUT `/:id/shipping-address`).
- **Parameter order**: the authenticated user (`@AuthUser() authUser: JwtUser`, see `api-custom-param-decorators`), then `@Param()`, then `@Query()` or `@Body()`, then optional extras.
- **DTO classes for `@Param()`, `@Query()` and `@Body()`** - no inline extraction (see `api-use-pipes`, `api-dto-naming`).
- **Status codes are explicit** where Nest's default differs from the table: `@HttpCode(HttpStatus.NO_CONTENT)` on `DELETE`, `@HttpCode(HttpStatus.OK)` on actions and `POST .../search`, `@HttpCode(HttpStatus.ACCEPTED)` when the work is queued (Nest defaults every `POST` to 201).
- **`@FormDataRequest()`** on endpoints that accept file uploads (see `api-file-uploads`).
- **Return service results directly** - no wrappers in the controller; the response envelope comes from a global interceptor (see `api-use-interceptors`).
- Swagger decorators per `api-document-with-openapi`.

**Incorrect (plural class, verbs in paths, wrong methods, logic in the controller):**

```typescript
@Controller('order')                                       // Singular path
export class OrdersController {                            // Plural class
  @Get('getOrder/:id')                                     // Verb in a GET path, camelCase
  async getOrder(@Param('id') id: string, @Req() req: Request) {
    const order = await this.orderRepository.findOne({ where: { id } }); // Data access in the controller
    return { data: order };                                // Ad-hoc wrapper
  }

  @Get(':id/cancel')                                       // State change on GET
  cancel(@Param('id') id: string) { /* ... */ }

  @Patch(':id')
  update(@Param() params: OrderIdParamDto, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(params.id, dto);       // dto.status: transitions hidden in PATCH
  }

  @Put()                                                   // PUT that creates a new order on every call
  create(@Body() dto: CreateOrderDto) { /* ... */ }

  @Get('status/:status')                                   // Filter as a path segment
  findByStatus(@Param('status') status: string) { /* ... */ }

  @Delete(':id')                                           // 200 instead of 204
  async remove(@Body() dto: DeleteOptionsDto, @Param('id') id: string) {
    await this.orderService.delete(id, dto);
    return { deleted: true };
  }
}
```

**Correct (singular class, plural kebab-case routes, REST semantics):**

```typescript
@ApiTags('Orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'List orders', description: 'Returns a page of the caller\'s orders, newest first.' })
  @Get()
  findAll(@AuthUser() authUser: JwtUser, @Query() query: FindAllOrdersQueryDto) {
    return this.orderService.findAll(authUser, query);
  }

  @ApiOperation({ summary: 'Search orders', description: 'Searches orders with criteria too complex for a query string.' })
  @HttpCode(HttpStatus.OK)
  @Post('search')
  search(@AuthUser() authUser: JwtUser, @Body() dto: SearchOrdersDto) { // see api-dto-naming
    return this.orderService.search(authUser, dto);
  }

  @ApiOperation({ summary: 'Get an order', description: 'Returns one of the caller\'s orders.' })
  @Get(':id')
  findById(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto) {
    return this.orderService.findById(authUser, params.id);
  }

  @ApiOperation({ summary: 'Download the invoice', description: 'Returns the order invoice as a PDF attachment.' })
  @Get(':id/download')
  async download(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto): Promise<StreamableFile> {
    const pdf = await this.orderService.renderInvoice(authUser, params.id);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="invoice-${params.id}.pdf"`,
    });
  }

  @ApiOperation({ summary: 'Create an order', description: 'Creates a pending order for the caller.' })
  @Post()
  create(@AuthUser() authUser: JwtUser, @Body() dto: CreateOrderDto) {
    return this.orderService.create(authUser, dto);
  }

  @ApiOperation({ summary: 'Update an order', description: 'Updates the note and delivery instructions.' })
  @Patch(':id')
  update(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(authUser, params.id, dto); // UpdateOrderDto has no status field
  }

  @ApiOperation({ summary: 'Set the shipping address', description: 'Creates or replaces the shipping address.' })
  @Put(':id/shipping-address')
  replaceShippingAddress(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto, @Body() dto: AddressDto) {
    return this.orderService.replaceShippingAddress(authUser, params.id, dto);
  }

  @ApiOperation({ summary: 'Cancel an order', description: 'Cancels a pending or paid order.' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto, @Body() dto: CancelOrderDto) {
    return this.orderService.cancel(authUser, params.id, dto); // dto: { reason? }
  }

  @ApiOperation({ summary: 'Delete an order', description: 'Soft-deletes the order and its items.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  delete(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto): Promise<void> {
    return this.orderService.delete(authUser, params.id);
  }
}

// A second controller in the module: named for its resource, nested route
@ApiTags('Order items')
@ApiBearerAuth('bearer')
@Controller('orders/:id/items')
export class OrderItemController {
  constructor(private readonly orderItemService: OrderItemService) {}

  @ApiOperation({ summary: 'List order items', description: 'Returns the items of one of the caller\'s orders.' })
  @Get()
  findAll(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto) {
    return this.orderItemService.findAll(authUser, params.id);
  }

  @ApiOperation({ summary: 'Get an order item', description: 'Returns 404 if the item is not part of the order.' })
  @Get(':itemId')
  findById(@AuthUser() authUser: JwtUser, @Param() params: OrderItemIdParamDto) {
    return this.orderItemService.findById(authUser, params.id, params.itemId);
  }
}
```

Reference: [NestJS Controllers](https://docs.nestjs.com/controllers) · [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/) · [RFC 9110 method semantics](https://www.rfc-editor.org/rfc/rfc9110#name-method-definitions)
