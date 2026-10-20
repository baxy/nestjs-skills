---
title: Control Response Serialization
impact: MEDIUM
impactDescription: Prevents accidental data exposure while keeping simple endpoints simple
tags: api, dto, serialization, class-transformer, entities
---

## Control Response Serialization

Register `ClassSerializerInterceptor` globally, in `configureApp()` and innermost (see `api-use-interceptors`), and decide, per column, what may leave the service. Two shapes are acceptable:

- **Returning the entity.** Fine when every column that must not leave the service carries `@Exclude()` together with `@ApiHideProperty()` (so it is hidden from both the response body and the OpenAPI schema). This is opt-out: a newly added column is public until someone hides it, so adding a column always includes deciding whether to hide it.
- **Returning a response DTO** (`{resource}-response.dto.ts`). Use one when the response shape differs from the entity (computed fields, a subset, nested projections, role-dependent fields) or for a public contract. A DTO with `@Expose()` and `excludeExtraneousValues: true` is opt-in: only listed fields leave the service. **Always pass `excludeExtraneousValues: true` when an entity is turned into a response DTO**, with `plainToInstance()` or `@SerializeOptions({ type })`: the conversion copies every entity property into the DTO and the entity's `@Exclude()` does not survive it, so without the option `passwordHash` is returned.

Entities are persistence classes (see `db-entity-conventions`): never bind a request body to an entity, never put `@Expose` or `@ApiProperty` on one, and never manually spread entity fields into ad-hoc objects.

**Incorrect (unhidden sensitive columns, entities as inputs, manual spreading):**

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  passwordHash: string; // Returned to every client

  @Column({ default: false })
  @Exclude({ toPlainOnly: true }) // Entity used as request input - clients can set isAdmin
  isAdmin: boolean;
}

@Controller('users')
export class UserController {
  @Post()
  create(@Body() user: User): Promise<User> { // Entity bound to the request body
    return this.userService.create(user);
  }

  @Get(':id')
  async findById(@Param() params: UserIdParamDto) {
    const user = await this.userService.findById(params.id);
    // Manual spreading - easy to forget a field, repeated per endpoint
    return { id: user.id, email: user.email, name: user.name };
  }
}
```

**Correct (hidden columns on entities, response DTOs where the shape differs):**

```typescript
// src/configure-app.ts - innermost, so the envelope wraps the serialized body
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new ResponseEnvelopeInterceptor(),
  new ClassSerializerInterceptor(app.get(Reflector)),
);

// user/entities/user.entity.ts - persistence decorators, plus @Exclude + @ApiHideProperty together
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @ApiHideProperty()
  @Exclude()
  @Column()
  passwordHash: string;

  @ApiHideProperty()
  @Exclude()
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

@Controller('users')
export class UserController {
  // Same shape as the entity: returning it is fine, hidden columns are stripped
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }

  // Different shape: use a response DTO
  @Get(':id/summary')
  @ApiEnvelopedResponse(UserSummaryResponseDto, { description: 'The user with their order count' }) // See api-document-with-openapi
  async findSummary(@Param() params: UserIdParamDto): Promise<UserSummaryResponseDto> {
    const user = await this.userService.findByIdWithOrders(params.id);
    return plainToInstance(UserSummaryResponseDto, user, { excludeExtraneousValues: true });
  }
}

// user/dtos/user-summary-response.dto.ts - opt-in: only @Expose fields are returned
export class UserSummaryResponseDto {
  @ApiProperty({ description: 'UUID of the user', example: '00000000-0000-0000-0000-000000000000' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Display name', example: 'Jane Doe' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Number of orders the user has placed', example: 3 })
  @Expose()
  @Transform(({ obj }) => obj.orders?.length ?? 0)
  orderCount: number;
}

// Role-dependent fields: serialization groups on a response DTO
export class UserProfileResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose({ groups: ['admin', 'owner'] })
  email: string;
}

@Get('me') // Declared before @Get(':id'), or ':id' matches 'me' first
@SerializeOptions({ type: UserProfileResponseDto, groups: ['owner'], excludeExtraneousValues: true }) // Without it, passwordHash is copied in
findMe(@AuthUser() authUser: JwtUser): Promise<User> {
  return this.userService.findById(authUser.id);
}
```

**Return entity instances, not spread copies.** `ClassSerializerInterceptor` applies `@Exclude()` only to class instances, and `repository.save()` returns the object it was given. `save({ ...user, ...dto })` or `manager.save(User, { ... })` therefore returns a plain object, and every hidden column on it (`passwordHash`, `deletedAt`) reaches the client. Create new rows with `repository.create()` (or `manager.create()`), and update a loaded entity with `repository.merge()` before saving.

```typescript
// Incorrect: a plain object comes back, so @Exclude() is skipped and passwordHash is returned
return this.userRepository.save({ ...user, ...dto });

// Correct: merge into the loaded instance; the serializer still sees a User
return this.userRepository.save(this.userRepository.merge(user, dto));
```

**`@SerializeOptions({ type })` is for a handler that returns one object or an array.** The serializer converts what the handler returns, and a paginated handler returns the `PaginatedResult` wrapper (`{ result, count, limit, offset }`, see `perf-optimize-database`), not the items. With `excludeExtraneousValues: true` every page then arrives as `data: {}`; without it the items are never converted. A page of entities needs nothing, because the serializer applies `@Exclude()` to the entity instances inside the wrapper. A page of response DTOs is converted item by item in the service:

```typescript
// Incorrect: converts the wrapper, so the client gets data: {}
@SerializeOptions({ type: UserListItemResponseDto, excludeExtraneousValues: true })
@Get()
findAll(@Query() query: FindAllUsersQueryDto): Promise<PaginatedResult<User>> {
  return this.userService.findAll(query);
}

// Correct: the service converts each item; the serializer leaves the wrapper alone
return {
  result: users.map((user) => plainToInstance(UserListItemResponseDto, user, { excludeExtraneousValues: true })),
  count,
  limit: query.limit,
  offset: query.offset,
};
```

Reference: [NestJS Serialization](https://docs.nestjs.com/techniques/serialization)
