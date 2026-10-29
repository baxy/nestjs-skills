---
title: Avoid N+1 Query Problems
impact: HIGH
impactDescription: N+1 queries are one of the most common performance killers
tags: database, n-plus-one, queries, performance, typeorm
---

## Avoid N+1 Query Problems

N+1 queries occur when you fetch a list of entities, then make an additional query for each entity to load related data. Use eager loading with `relations`, query builder joins, or DataLoader to batch queries efficiently.

**Incorrect (lazy loading in loops causes N+1):**

```typescript
// Lazy loading in loops causes N+1
@Injectable()
export class OrderService {
  async getOrdersWithItems(userId: string): Promise<Order[]> {
    const orders = await this.orderRepository.find({ where: { userId } });
    // 1 query for orders

    for (const order of orders) {
      // N additional queries - one per order!
      order.items = await this.orderItemRepository.find({ where: { orderId: order.id } });
    }

    return orders;
  }
}

// Accessing lazy relations without loading
@Controller('users')
export class UserController {
  @Get()
  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();
    // If User.posts is lazy-loaded, serializing triggers N queries
    return users; // Each user.posts access = 1 query
  }
}
```

**Correct (use relations for eager loading):**

```typescript
// Use relations option for eager loading
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getOrdersWithItems(userId: string): Promise<Order[]> {
    // Single query with JOIN
    return this.orderRepository.find({
      where: { userId },
      relations: { items: { product: true } },
    });
  }
}

// Use QueryBuilder for complex joins
@Injectable()
export class UserService {
  async getUsersWithPostCounts(): Promise<UserWithPostCount[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.posts', 'post')
      .select('user.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('COUNT(post.id)', 'postCount')
      .groupBy('user.id')
      .getRawMany();
  }

  async getActiveUsersWithPosts(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.posts', 'post')
      .leftJoinAndSelect('post.comments', 'comment')
      .where('user.isActive = :active', { active: true })
      .andWhere('post.status = :status', { status: 'published' })
      .getMany();
  }
}

// Use find options for specific fields
async getOrderSummaries(userId: string): Promise<OrderSummary[]> {
  return this.orderRepository.find({
    where: { userId },
    relations: { items: true },
    select: {
      id: true,
      total: true,
      status: true,
      items: {
        id: true,
        quantity: true,
        price: true,
      },
    },
  });
}

// GraphQL only: a request-scoped DataLoader batches the per-parent lookups (see di-scope-awareness)
import DataLoader from 'dataloader';

@Injectable({ scope: Scope.REQUEST })
export class PostsLoader {
  constructor(private readonly postService: PostService) {}

  readonly batchPosts = new DataLoader<string, Post[]>(async (userIds) => {
    // Single query for all users' posts
    const posts = await this.postService.findByUserIds([...userIds]);

    // Group by userId
    const postsMap = new Map<string, Post[]>();
    for (const post of posts) {
      const userPosts = postsMap.get(post.userId) || [];
      userPosts.push(post);
      postsMap.set(post.userId, userPosts);
    }

    // Return in same order as input
    return userIds.map((id) => postsMap.get(id) || []);
  });
}

// In resolver
@ResolveField()
async posts(@Parent() user: User): Promise<Post[]> {
  // DataLoader batches multiple calls into single query
  return this.postsLoader.batchPosts.load(user.id);
}

// Detect N+1 locally: DB_LOGGING=true turns on TypeORM query logging (db.logging, see devops-use-config-module)
```

Reference: [TypeORM Relations](https://typeorm.io/relations)
