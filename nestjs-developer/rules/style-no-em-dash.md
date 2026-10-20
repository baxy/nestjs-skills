---
title: Never Use the Em Dash
impact: MEDIUM
impactDescription: Consistent punctuation in code, comments, docs and API text
tags: style, punctuation, docs, comments
---

## Never Use the Em Dash

Never use the em dash character (`—`) anywhere: code, comments, string literals, error messages, Swagger descriptions, docs, READMEs, commit messages and PR descriptions. Use a standard hyphen (`-`), usually with spaces around it, or restructure the sentence (a colon, parentheses, or two sentences).

Check before committing:

```bash
grep -rn "—" src test docs
```

**Incorrect (em dash in comments, messages and docs):**

```typescript
// Soft delete — the row stays for audit
throw new BadRequestException('Quantity must be a positive integer — at least 1');

@ApiOperation({
  summary: 'Cancel an order',
  description: 'Cancels the order — shipped orders cannot be canceled.',
})
```

**Correct (hyphen or restructured sentence):**

```typescript
// Soft delete - the row stays for audit
throw new BadRequestException('Quantity must be a positive integer of at least 1');

@ApiOperation({
  summary: 'Cancel an order',
  description: 'Cancels the order. Shipped orders cannot be canceled.',
})
```
