---
title: Generate Migrations from Entities
impact: HIGH
impactDescription: Keeps the database schema and the ORM model in sync, without drift
tags: database, migrations, typeorm, schema
---

## Generate Migrations from Entities

`synchronize` is hardcoded to `false` in the TypeORM options, in every environment including local development, and is never read from config or an environment variable. Every schema change goes through a migration, and every **structural** migration (tables, columns, constraints, indexes, foreign keys) is **generated** from the entity changes with `migration:generate`. Do not hand-write structural migrations, and do not scaffold an empty file with `migration:create` and fill in DDL yourself.

Hand-written SQL drifts from TypeORM's naming for constraints, indexes and foreign keys. Once applied, the schema no longer matches what TypeORM expects, and the next `migration:generate` produces spurious statements that drop and recreate those objects just to rename them. `migration:create` is only for migrations that do not touch table structure: data backfills and one-off scripts.

Workflow:

1. Change the entities.
2. Run `migration:generate`, then review the generated file.
3. Run `migration:run`.
4. Run `migration:generate` once more. It must produce no new migration; if it does, the previous migration drifted from the entities. Fix that before moving on.

**When you cannot run the CLI** (no database or shell available), stop after step 1: change the entities, write no structural migration file, and hand over the exact commands for steps 2 to 4 with the migration name. A hand-written stand-in labeled "regenerate this" still gets committed sometimes, and it is the drift this rule prevents. Data-only migrations (`migration:create`) can still be written by hand.

Conventions:

- Filenames are lowercase and dash-separated; the class name stays PascalCase: `1777494397675-create-order-items-table.ts` containing `CreateOrderItemsTable1777494397675`.
- Leave table and index names unqualified in migration SQL. TypeORM's `schema` option qualifies the migrations table and entity queries, but not the raw SQL inside migration files, which follows the connection's `search_path`. When the app uses a non-`public` schema, set the `search_path` on the migration connection (schema first, then `public`) and strip any hardcoded schema prefix that `migration:generate` emits (for example `DROP INDEX "public"."..."` in a `down()`).

**Incorrect (synchronize, ad-hoc DDL, or hand-written structural migrations):**

```typescript
// synchronize turned on, or read from config
TypeOrmModule.forRoot({
  type: 'postgres',
  synchronize: true, // Can drop columns, tables, or data
});
synchronize: dbSettings.synchronize, // One wrong environment variable away from the line above

// DDL at runtime, outside any migration
await this.dataSource.query('ALTER TABLE users ADD COLUMN age INT');

// Hand-written structural migration: index and constraint names will not
// match TypeORM's, so the next migration:generate shows drift
// migrations/1705312800000-AddUserAge.ts   (also: PascalCase filename)
export class AddUserAge1705312800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."users" ADD "age" integer DEFAULT 0`);
    await queryRunner.query(`CREATE INDEX "users_age_idx" ON "users" ("age")`);
  }
  // ...
}
```

**Correct (generate from entities, create only for data changes):**

```typescript
// 1. Change the entity
@Entity('users')
@Index('IDX_users_age', ['age'])
export class User {
  // ...
  @Column({ type: 'integer', default: 0 })
  age: number;
}
```

```bash
# 2. Generate, review, run - then confirm there is no drift
pnpm run migration:generate migrations/add-user-age
pnpm run migration:run
pnpm run migration:generate migrations/drift-check   # must report no changes
```

```typescript
// Generated: migrations/1705312800000-add-user-age.ts
export class AddUserAge1705312800000 implements MigrationInterface {
  name = 'AddUserAge1705312800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "age" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(`CREATE INDEX "IDX_users_age" ON "users" ("age") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_age"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`);
  }
}

// Data-only change: migration:create is correct here
// migrations/1705313000000-backfill-user-display-names.ts
export class BackfillUserDisplayNames1705313000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "display_name" = "first_name" WHERE "display_name" IS NULL`,
    );
  }

  public async down(): Promise<void> {
    // Backfill is not reversible; nothing to undo structurally
  }
}

// Migration datasource for a non-public schema: SET search_path right after connecting
class SchemaClient extends pg.Client {
  async connect(): Promise<void> {
    await super.connect();
    await this.query(`SET search_path TO "${process.env.DB_SCHEMA}", public`);
  }
}

export default new DataSource({
  type: 'postgres',
  schema: process.env.DB_SCHEMA,
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  extra: { Client: SchemaClient },
});
```

For large renames, generate the structural steps and put the data copy in a separate `migration:create` migration between them (add column, copy data, drop old column), so each structural step still comes from the entities.

Reference: [TypeORM Migrations](https://typeorm.io/docs/migrations/why)
