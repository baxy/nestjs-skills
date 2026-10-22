---
title: Name Everything in a Resource Module After the Module
impact: HIGH
impactDescription: Any name shows which module owns it, names never collide, and a module's code is found with one search
tags: architecture, naming, modules, entities, services, conventions
---

## Name Everything in a Resource Module After the Module

A resource module is named for its resource, in the singular, and **every class, file and injected property it declares starts with that name**. `OrderItemService` read in another module says where it comes from without opening it; `ItemService` does not, and collides with the next module that has items. `grep -r Order src` finds the whole module, and its files sort together in every folder.

**One singular name per resource.** The module folder, the module, controller, service and entity classes, their files and the injected properties all use the singular resource name. It is plural in exactly two places: the URL (`@Controller('orders')`, see `api-controller-conventions`) and the database table (`@Entity('orders')`, see `db-entity-conventions`).

| Element | Name |
|---|---|
| Module folder | `src/order/` |
| Module | `OrderModule` in `order.module.ts` |
| Entity | `Order` in `entities/order.entity.ts`; table `orders` |
| Service | `OrderService` in `services/order.service.ts`; injected as `orderService` |
| Controller | `OrderController` in `controllers/order.controller.ts` |
| Test folders | `test/e2e/order/order.spec.ts` (mirror `src/`) |

Uncountable nouns keep their form (`analytics/`, `metadata/`).

**Everything else in the module takes the prefix too**, whatever its type folder:

| Kind | Example in `src/order/` |
|---|---|
| Sub-resource entity | `OrderItem` in `entities/order-item.entity.ts`; table `order_items` |
| Its service and controller | `OrderItemService`, `OrderItemController` |
| Helper services and providers | `OrderPricingService`, `OrderNumberGenerator`, `OrderOwnerGuard` |
| DTOs (verb first, see `api-dto-naming`) | `CreateOrderItemDto`, `OrderItemIdParamDto`, `FindAllOrderItemsQueryDto`, `OrderItemResponseDto` |
| Enums and types | `OrderStatus`, `OrderItemKind`, `OrderSummary` |
| Error, event, listener and processor classes | `OrderNotCancelableError`, `OrderCreatedEvent`, `OrderPaymentEventsListener`, `OrderExportProcessor` |
| Exported constants | `ORDER_REASON_MAX_LENGTH`, `ORDER_CANCELABLE_STATUSES` |
| Injected properties | `orderItemRepository`, `orderPricingService` |

- **Sub-resources keep the prefix in code and in the table**, and drop it in the URL when the parent route already gives the context: `OrderItem`, `order_items`, `GET /orders/:orderId/items`. A table has no parent to read it from; a route does. When the parent route belongs to another module, the segment keeps the prefix: payment refunds listed under orders are `GET /orders/:orderId/payment-refunds`, served by the payment module.
- **Listeners: one class per source module, one method per event.** The class takes the prefix of the module it lives in, then the module whose events it handles: `OrderPaymentEventsListener` in `order/listeners/order-payment-events.listener.ts`, with `onPaymentCaptured()` for `payment.captured` and `onPaymentRefunded()` for `payment.refunded`. Two modules that listen to the same event never declare the same class, and everything a module does in reaction to another module is in one file. A module listening to its own events uses `{Module}EventsListener`.
- **Internal routes put `Internal` right after the module name**: `OrderInternalController` for `/internal/orders`, `OrderInternalIdParamDto`, `OrderInternalFile`; DTOs keep their verb first, `CreateOrderInternalDto` (see `api-dto-naming`). The module name still leads every name, and `grep Internal` lists the internal surface.
- **One name per resource, in every form.** The module folder carries the resource's full name, and nothing in it uses a shorter or longer variant: `ContentShare` lives in `content-share/`, never `acl/` or `share/`; an `ArtifactGroup` module does not hold a `Group` entity next to an `ArtifactGroupIdParamDto`.
- **A query or param piece used only inside the module takes the prefix** (`OrderSortQueryDto`, `OrderLangQueryDto`). One reused by several modules lives in `src/shared/dtos/`, named for its concern (`pagination.query.dto.ts`).
- **A route that nests this module's resource under another module's resource** gets a param DTO named for the route, parent first, the same way `OrderItemIdParamDto` names `/orders/:id/items/:itemId`: `ArtifactGroupIdParamDto` in `group/` for `/artifacts/:artifactId/groups/:groupId`, next to `GroupIdParamDto` for `/groups/:groupId`.
- **The prefix appears once.** A name that already starts with the module name does not repeat it: `OrderItem`, never `OrderOrderItem`. Param DTOs follow `api-dto-naming` and are named for the deepest resource (`OrderItemIdParamDto`), not for every resource in the route.
- **Plain functions keep descriptive names**, which usually contain the noun already: `calculateOrderTotal()` in `utils/calculate-order-total.ts`. A prefix glued onto a verb (`orderCalculateTotal`) reads worse.
- **Constants that stay in their file** (not exported) are named for what they hold, like local variables: `HASH_OPTIONS`, `PG_UNIQUE_VIOLATION`. The prefix is for names other files see; an exported constant always takes it.
- **A sub-resource that outgrows its parent gets its own module.** When other modules use it on its own, when it has its own lifecycle, or when its names pass three words (`OrderItemReturnLabelService`), it is a resource of its own: `return/` with `ReturnLabel`, `ReturnLabelService`.

**In a module whose existing names break this rule**, new names follow the rule (code added to a `share/` module that holds `ContentShare` is named `ContentShare…`). Do not rename existing names as part of an unrelated change: a rename touches every importer and buries the real change in the diff. List them in your summary as a separate refactor.

**Modules that are not resources** follow their own naming:

- A module built around a capability is named for the capability (`auth/`, `mail/`, `health/`, `encryption/`), and its classes for what they are: `JwtStrategy`, `RolesGuard`, `MailService`, `ShutdownDrain`.
- Implementations of one abstraction are named `{Variant}{Abstraction}`: `StripePaymentGateway`, `FakePaymentGateway`, `KmsSecretCipher` (see `di-use-interfaces-tokens`).
- `src/shared/` and `src/config/` hold no module, so their files are named for what they hold (`pagination.query.dto.ts`, `db.config.ts`).

**Incorrect (generic names that hide the owner and collide across modules):**

```typescript
src/order/
├── entities/
│   ├── order.entity.ts
│   └── item.entity.ts               // Item: whose item? the catalog module has items too
├── services/
│   ├── orders.service.ts            // plural
│   ├── item.service.ts
│   └── pricing.service.ts           // PricingService: also the name of the pricing module's service
├── dtos/
│   └── create-item.dto.ts
├── types/
│   └── status.enum.ts               // Status: imported elsewhere, says nothing
└── order.module.ts

@Injectable()
export class ItemService {
  constructor(@InjectRepository(Item) private readonly repo: Repository<Item>) {}
}
```

**Correct (the module name starts every name it owns):**

```typescript
src/order/
├── controllers/
│   ├── order.controller.ts          // /orders
│   └── order-item.controller.ts     // /orders/:orderId/items
├── entities/
│   ├── order.entity.ts              // table orders
│   └── order-item.entity.ts         // table order_items
├── services/
│   ├── order.service.ts
│   ├── order-item.service.ts
│   └── order-pricing.service.ts
├── dtos/
│   ├── create-order-item.dto.ts
│   └── order-item-id.param.dto.ts
├── types/
│   └── order-status.enum.ts
├── utils/
│   └── calculate-order-total.ts
└── order.module.ts

@Injectable()
export class OrderItemService {
  constructor(
    @InjectRepository(OrderItem) private readonly orderItemRepository: Repository<OrderItem>,
    private readonly orderPricingService: OrderPricingService,
  ) {}
}
```
