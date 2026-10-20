---
title: Optimize Database Queries
impact: HIGH
impactDescription: Database queries are typically the largest source of latency
tags: performance, database, queries, optimization
---

## Optimize Database Queries

Select only needed columns, use proper indexes, avoid over-fetching relations, and consider query performance when designing your data access. Most API slowness traces back to inefficient database queries.

**Incorrect (over-fetching data and missing indexes):**

```typescript
// Select everything when you need few fields
@Injectable()
export class UserService {
  async findAllEmails(): Promise<string[]> {
    const users = await this.userRepository.find();
    // Fetches ALL columns for ALL users
    return users.map((u) => u.email);
  }

  async getUserSummary(id: string): Promise<UserSummary> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['posts', 'posts.comments', 'posts.comments.author', 'followers'],
    });
    // Over-fetches massive relation tree
    return { name: user.name, postCount: user.posts.length };
  }
}

// No indexes on frequently queried columns
@Entity()
export class Order {
  @Column()
  userId: string; // No index - full table scan on every lookup

  @Column()
  status: string; // No index - slow status filtering
}
```

**Correct (select only needed data with proper indexes):**

```typescript
// Select only needed columns
@Injectable()
export class UserService {
  async findAllEmails(): Promise<string[]> {
    const users = await this.userRepository.find({
      select: { email: true }, // Only fetch the email column
    });
    return users.map((u) => u.email);
  }

  // Use QueryBuilder for complex selections
  async getUserSummary(id: string): Promise<UserSummary> {
    return this.userRepository
      .createQueryBuilder('user')
      .select('user.name', 'name')
      .addSelect('COUNT(post.id)', 'postCount')
      .leftJoin('user.posts', 'post')
      .where('user.id = :id', { id })
      .groupBy('user.id')
      .getRawOne();
  }

  // Fetch relations only when needed
  async getFullProfile(id: string): Promise<User> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['posts'], // Only immediate relation
      select: {
        id: true,
        name: true,
        email: true,
        posts: {
          id: true,
          title: true,
        },
      },
    });
  }
}

// Index the columns queries filter and sort on (see db-entity-conventions for the entity rules)
@Entity('orders')
@Index('IDX_orders_user_id_status', ['userId', 'status']) // Also serves queries on userId alone
@Index('IDX_orders_created_at', ['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  status: OrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

// Always paginate list endpoints: offset-based, limit 20 / offset 0 by default
// (query DTOs extend PaginationQueryDto, see api-dto-naming)
export interface PaginatedResult<T> {
  result: T[];
  count: number; // total matching rows, not the page length
  limit: number;
  offset: number;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findAll(authUser: JwtUser, query: FindAllOrdersQueryDto): Promise<PaginatedResult<Order>> {
    const [result, count] = await this.orderRepository.findAndCount({
      where: { userId: authUser.id }, // Only the caller's own orders
      skip: query.offset,
      take: query.limit,
      order: { createdAt: 'DESC' }, // Stable order, newest first
    });

    return { result, count, limit: query.limit, offset: query.offset };
  }
}

// The response envelope interceptor (api-use-interceptors) turns this into
// { success: true, statusCode: 200, data: result, meta: { totalCount: count, limit, offset } }
```

Reference: [TypeORM Query Builder](https://typeorm.io/select-query-builder)
