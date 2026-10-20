---
title: Use US-English Spelling
impact: MEDIUM
impactDescription: One spelling for every term, so code and docs stay searchable
tags: style, spelling, naming, docs
---

## Use US-English Spelling

Use US-English spelling everywhere: identifiers, comments, string literals, error messages, Swagger descriptions, docs, READMEs, commit messages and PR descriptions. Mixed spellings break searches (`grep authorize` misses `authorise`) and produce near-duplicate names.

| US (use) | Not |
|---|---|
| authorize, initialize, serialize, normalize, organize | authorise, initialise, serialise, normalise, organise |
| behavior, color, favor | behaviour, colour, favour |
| analyze, catalog, center | analyse, catalogue, centre |
| license (noun and verb), canceled | licence, cancelled |

The only exception is a name you do not control, such as a third-party API field or library option; keep it as-is and use US spelling for your own wrapper around it.

**Incorrect (British spellings in names, messages and docs):**

```typescript
export class OrderSerialiser {
  initialise(): void { /* ... */ }

  private _assertAuthorised(user: JwtUser, order: Order): void {
    throw new ForbiddenException('User is not authorised to view this order');
  }
}

throw new BadRequestException('A cancelled order cannot be shipped');

@ApiOperation({ summary: 'Get preferences', description: 'Returns the user colour and behaviour settings.' })
```

**Correct (US spelling throughout):**

```typescript
export class OrderSerializer {
  initialize(): void { /* ... */ }

  private _assertAuthorized(user: JwtUser, order: Order): void {
    throw new ForbiddenException('User is not authorized to view this order');
  }
}

throw new BadRequestException('A canceled order cannot be shipped');

@ApiOperation({ summary: 'Get preferences', description: 'Returns the user color and behavior settings.' })
```
