---
title: Sanitize User HTML and Never Reflect Unvalidated Input
impact: HIGH
impactDescription: Stored or reflected markup cannot run in a browser that renders API data
tags: security, xss, sanitization, html, helmet
---

## Sanitize User HTML and Never Reflect Unvalidated Input

A JSON API is not executed by the browser, but its data is rendered by clients that may trust it. Three habits keep stored and reflected markup harmless:

- **Rich-text fields are sanitized on the way in**, in the DTO, with an allow-list (`sanitize-html`). Plain-text fields strip all tags. Sanitizing once, at the boundary, means every consumer of the stored value gets the same safe content.
- **Error messages only echo validated values.** A UUID validated by a param DTO can appear in a message (see `error-throw-http-exceptions`); free text from the client never does.
- **Responses are JSON**, which Nest sets by default. An endpoint that must return HTML builds it from escaped values, and `helmet` sets a Content Security Policy on every response (see `api-platform-agnostic` for the per-platform package).

**Incorrect (raw HTML stored, input reflected, HTML built by concatenation):**

```typescript
export class CreateCommentDto {
  @IsString()
  content: string; // <script>...</script> stored as-is and served to every client
}

@Controller('pages')
export class PageController {
  @Get(':slug')
  @Header('Content-Type', 'text/html')
  async findBySlug(@Param() params: PageSlugParamDto): Promise<string> {
    const page = await this.pageService.findBySlug(params.slug);
    return `<html><body>${page.content}</body></html>`; // User content concatenated into HTML
  }
}

// Unvalidated input echoed back
throw new BadRequestException(`Unknown sort field ${query.sort}`);
```

**Correct (sanitized at the boundary, validated echoes, CSP):**

```typescript
// shared/utils/sanitize.ts
export const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};

// comment/dtos/create-comment.dto.ts
export class CreateCommentDto {
  @ApiProperty({ description: 'Comment body; basic formatting tags are kept', example: '<p>Looks <b>great</b></p>' })
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, RICH_TEXT_OPTIONS) : value))
  content: string;

  @ApiProperty({ description: 'Comment title, plain text', example: 'Release notes' })
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  title: string;
}

// The sort field is validated with @IsIn by the DTO, so the message needs no echo at all
throw new BadRequestException('Unknown sort field');

// main.ts - Content Security Policy on every response
const helmetOptions = {
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'https:'] },
  },
};
await app.register(helmet, helmetOptions); // Fastify (@fastify/helmet); Express: app.use(helmet(helmetOptions))
```

Reference: [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) · [sanitize-html](https://github.com/apostrophecms/sanitize-html)
