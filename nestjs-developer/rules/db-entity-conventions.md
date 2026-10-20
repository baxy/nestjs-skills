---
title: Keep Entities Persistence-Only and Consistent
impact: MEDIUM-HIGH
impactDescription: Entities describe the schema and nothing else, with uniform columns across tables
tags: database, typeorm, entities, schema, conventions, naming-strategy, postgres
---

## Keep Entities Persistence-Only and Consistent

Entities represent the database schema. They carry only persistence decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, relations, `@Index`, `@Check`), with one exception: `@Exclude()` (class-transformer) and `@ApiHideProperty()` (Swagger) **together** on columns that must stay out of both the response body and the OpenAPI schema, such as `deletedAt`. `@ApiProperty` and `@Expose` never go on entities: anything that describes or opts fields into a schema belongs in a DTO (see `api-use-dto-serialization`).

Conventions:

- The entity class is **singular** and the table **plural**: `Order` in `order/entities/order.entity.ts` maps to `@Entity('orders')`; `OrderItem` maps to `@Entity('order_items')`. Always pass the table name explicitly (see `arch-feature-modules`).
- Properties are camelCase; the required `SnakeNamingStrategy` (below) maps them to snake_case columns. Never write column names by hand; the one exception is the foreign key below.
- Timestamps: `@CreateDateColumn({ type: 'timestamptz' })` and `@UpdateDateColumn({ type: 'timestamptz' })`.
- Soft deletes: `@DeleteDateColumn({ type: 'timestamptz', nullable: true })`, hidden with `@Exclude()` + `@ApiHideProperty()`. Delete with `softDelete()` or `softRemove()`; `delete()` and `remove()` still remove the row. `softRemove()` also soft-deletes loaded children whose relation has `cascade: ['soft-remove']`. `find*` and the query builder skip soft-deleted rows; raw SQL filters `deleted_at IS NULL` itself.
- Complex structured data: `@Column({ type: 'jsonb' })`, plus `nullable: true` or a `default` when the value is optional.
- Relations: `@ManyToOne` / `@OneToMany`. The owning side declares the foreign key twice, as the relation and as a plain `userId` column, and `@JoinColumn({ name: 'user_id' })` pins both to the same column. The name matches what the naming strategy generates; writing it out keeps the pairing visible and stops a second column appearing when the relation is renamed.
- Sensitive columns: `@Exclude()` + `@ApiHideProperty()`.
- Indexes and constraints are named explicitly: `IDX_`, `UQ_` or `CHK_`, then the table, then the columns or the purpose (`IDX_orders_user_id_status`, `UQ_users_email_active`, `CHK_orders_total_non_negative`). Database-tier tests match on these names (see `test-database-tier`), and a generated name changes whenever the columns do.
- Every structural change ships with a generated migration (see `db-use-migrations`).

### `SnakeNamingStrategy` is required

Every database object (tables, columns, join columns, junction tables, foreign keys) is named in lowercase `snake_case`. Configure `SnakeNamingStrategy` (from `typeorm-naming-strategies`) on **every** `DataSource`: the one the app uses **and** the one the migration CLI uses.

Why:

- **PostgreSQL folds unquoted identifiers to lower case, and quoting makes them case-sensitive.** `FOO`, `foo` and `"foo"` are the same name, but `"Foo"` is a different one (PostgreSQL docs, *Identifiers and Key Words*).
- **TypeORM's default naming strategy uses the property name as the column name.** Without a naming strategy, `createdAt` becomes a column literally named `"createdAt"`. Every raw query, migration, `psql` session, BI tool and report must then double-quote it. An unquoted `created_at` or `createdAt` fails with `column "createdat" does not exist`.
- **The PostgreSQL community's own advice is "Don't use NamesLikeThis, use names_like_this"** (PostgreSQL wiki, *Don't Do This*). Mixed-case names force you to always or never quote them, and tools disagree on which they do. With only `a-z`, `0-9` and `_` you never have to think about quoting.
- **The database is shared beyond the ORM.** Analysts, other services, data pipelines and DBAs read it without knowing your entity classes. `snake_case` is the convention they expect.
- **One central rule instead of per-column overrides.** Hand-written `@Column({ name: 'created_at' })` is forgotten on the next column and never applies to join columns or junction tables. The strategy names everything consistently.
- **Both DataSources must match.** If the migration DataSource uses a different strategy than the app, `migration:generate` sees every column as renamed and produces drift (see `db-use-migrations`).

The package version must support your TypeORM major version. `typeorm-naming-strategies` declares support for TypeORM 0.2 and 0.3. On a newer TypeORM, use a package that declares support for it, or a small subclass of TypeORM's `DefaultNamingStrategy`.

**Incorrect (default naming strategy, per-column overrides):**

```typescript
// No namingStrategy: properties become camelCase columns
TypeOrmModule.forRootAsync({ /* type, host, port... */ useFactory: () => ({ type: 'postgres', autoLoadEntities: true }) });

// Generated DDL:  CREATE TABLE "orders" ("id" uuid, "userId" uuid, "createdAt" timestamptz, ...)
// Raw SQL now has to quote every column:
await dataSource.query('SELECT id FROM orders WHERE userId = $1', [userId]);
// ERROR: column "userid" does not exist  (unquoted name folded to lower case)

// Per-column overrides: inconsistent, and forgotten on the next column
@Column({ name: 'created_at' })
createdAt: Date;

@Column()
updatedAt: Date; // Still "updatedAt"
```

**Correct (snake_case everywhere, through one strategy on every DataSource):**

```typescript
// app.module.ts - the app DataSource
TypeOrmModule.forRootAsync({
  inject: [dbConfig.KEY],
  useFactory: (dbSettings: ConfigType<typeof dbConfig>) => ({
    type: 'postgres',
    host: dbSettings.host,
    port: dbSettings.port,
    username: dbSettings.username,
    password: dbSettings.password,
    database: dbSettings.name,
    schema: dbSettings.schema,
    autoLoadEntities: true,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false, // Hardcoded, never from config (see db-use-migrations)
  }),
});

// migrations/type-orm/config.ts - the migration CLI DataSource uses the same strategy.
// It runs outside Nest, so it is the one place besides src/config/ that reads process.env
// (see devops-use-config-module), with the same DB_* variables.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
});

// Generated DDL:  CREATE TABLE "orders" ("id" uuid, "user_id" uuid, "created_at" timestamptz, ...)
// Raw SQL needs no quoting:
await dataSource.query('SELECT id FROM orders WHERE user_id = $1', [userId]);
```

**Incorrect (API concerns on the entity, inconsistent columns):**

```typescript
@Entity()                                         // Table name left to the class name
export class Order {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' }) // Swagger on an entity
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose()                                       // Serialization opt-in on an entity
  @Column({ name: 'order_status' })               // Hand-written column name
  status: OrderStatus;

  @CreateDateColumn()                             // timestamp without time zone
  created_at: Date;                               // snake_case property

  @DeleteDateColumn()
  deletedAt: Date;                                // Soft-delete timestamp leaks into responses

  @ManyToOne(() => User)
  user: User;                                     // Implicit foreign key name
}
```

**Correct (persistence-only, uniform columns):**

```typescript
// order/entities/order.entity.ts
@Entity('orders')
@Index('IDX_orders_user_id_active', ['userId'], { where: 'deleted_at IS NULL' })
@Check('CHK_orders_total_non_negative', '"total" >= 0')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: OrderStatus.Pending })
  status: OrderStatus;

  @Column({ type: 'integer' })
  total: number; // Minor units (cents)

  @Column({ type: 'jsonb' })
  shippingAddress: Address;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiHideProperty()
  @Exclude()
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

```

Reference: [TypeORM Entities](https://typeorm.io/docs/entity/entities) · [PostgreSQL: Identifiers and Key Words](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS) · [PostgreSQL wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_upper_case_table_or_column_names) · [typeorm-naming-strategies](https://www.npmjs.com/package/typeorm-naming-strategies)
