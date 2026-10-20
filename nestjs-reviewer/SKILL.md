---
name: nestjs-reviewer
description: Reviews NestJS code changes, branches and pull requests against the nestjs-developer conventions (architecture, dependency injection, REST controllers, DTOs, security, TypeORM, testing, code style). Use when asked to review NestJS code or a NestJS pull request, to check a controller, service, module, guard, interceptor, DTO, entity, migration or test in a NestJS project, or to validate a NestJS feature after implementing it.
allowed-tools: Read, Grep, Glob, Bash
metadata:
  version: "1.0.0"
  requires: nestjs-developer
---

# NestJS Reviewer

Reviews NestJS code against the rules of the `nestjs-developer` skill. Every Critical and Warning finding is backed by `file:line` evidence, a concrete fix, and the ID of the rule it breaks.

## Sources

- `../nestjs-developer/rules/<rule-id>.md` (relative to this skill folder) - the rule, with incorrect and correct examples. Read the rule before reporting a finding against it. If the folder is missing, review with the two references below only and say so in the Summary.
- `references/checklist.md` - what to check per area, each item tagged with its rule ID.
- `references/anti-patterns.md` - common problems, with the fix.

## Workflow

Copy this checklist into your response and tick it off:

```
- [ ] 1. Scope identified
- [ ] 2. Each affected area checked
- [ ] 3. Findings verified
- [ ] 4. Report written
```

1. **Scope.** For a PR or branch, start from the diff against the base branch (`git diff <base>...HEAD`). Review the changed files plus what they directly depend on (their module, DTOs, entities, tests). Flag pre-existing code only when the change relies on it.
2. **Check each affected area** with the matching sections of `references/checklist.md` (a new endpoint touches Controllers, Swagger, DTOs, Guards and Testing). For every candidate finding, open the rule file and confirm the rule says what you are about to claim.
3. **Verify findings** (required). Every Critical and Warning has the path, line, exact snippet and a concrete fix. Drop any candidate that no rule covers and that has no concrete defect.
4. **Report** in the format below.

## Severity

| Severity | When |
|---|---|
| Critical | Security hole (unguarded protected route, password stored plain, fast-hashed or encrypted, sensitive column without `@Exclude()` + `@ApiHideProperty()`, entity converted to a response DTO without `excludeExtraneousValues: true`, injection, secret in code), data loss or corruption (multi-entity write without a transaction, `synchronize: true` or `synchronize` read from config, destructive migration), or code that crashes or breaks an endpoint |
| Warning | Any other violation of a `nestjs-developer` rule, including the `style-` rules |
| Suggestion | An improvement no rule requires: readability, performance, developer experience |

The rule's impact level (CRITICAL to LOW) orders findings within a severity; it does not set the severity.

## Constraints

- The `db-` rules and the TypeORM checklist items are written for TypeORM on PostgreSQL. In a project on another ORM (Prisma, Drizzle, MikroORM), check the intent (transactions, generated migrations, no N+1, hidden sensitive fields) and do not flag the absence of TypeORM APIs.
- When the project follows a documented convention of its own that conflicts with a rule, report the conflict once as a Suggestion instead of a Warning on every occurrence.
- Returning an entity is not a finding by itself (`api-use-dto-serialization`).
- bcrypt in a project that already stores bcrypt hashes is not a finding. bcrypt cost below 12, or no 72-byte limit on the password, is a Warning; a new project choosing bcrypt over Argon2id is a Suggestion (`security-hash-passwords`).
- When the PR says it makes a change whose required companion is missing from the changed files (an entity change without a generated migration, a new endpoint without its e2e spec), report the gap at the severity it would have and state the assumption. Downgrade it only when the PR shows the companion exists or the rule does not apply.
- Do not suggest architectural rewrites unless a Critical issue requires one.
- This skill reviews. Change code only when the user asks for fixes.

## Report format

1. **Summary** - scope reviewed and the key observations in 2-4 sentences.
2. **Critical issues (must fix)**
3. **Warnings (should fix)**
4. **Suggestions (consider)**
5. **Positive observations** - patterns worth keeping.
6. **Recommendations** - prioritized next steps.

Write "None" under an empty section. Each finding in sections 2-4 follows this shape:

````markdown
**Unguarded delete route** - `security-use-guards`
`src/order/controllers/order.controller.ts:58`
```typescript
@Public()
@Delete(':id')
delete(@Param() params: OrderIdParamDto): Promise<void> {
```
Why: `@Public()` skips the global JWT guard, so anyone can delete any order.
Fix: remove `@Public()`; the global guard then requires a token, and the service scopes the delete to the caller's orders.
````
