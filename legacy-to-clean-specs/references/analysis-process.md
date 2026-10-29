# Analysis Process

Use these patterns during the Explore step. Adapt globs/greps to the language and framework.

## 1. Project Structure & Entry Points
```bash
# Entry points
Glob: **/main.{ts,js,py,go,java}
Glob: **/app.{ts,js,py}
Glob: **/index.{ts,js}
Glob: **/cmd/**/*.go

# Routes / controllers
Glob: **/routes/**/*.{ts,js}
Glob: **/controllers/**/*.{ts,js,java}
Grep: @Controller|@Get|@Post|router\.|app\.get|app\.post|@RequestMapping
```

## 2. Data Models
```bash
Glob: **/models/**/*.{ts,js,py}
Glob: **/entities/**/*.{ts,js,java}
Glob: **/schema*.{ts,js,py,sql}
Glob: **/migrations/**/*
Grep: @Entity|class .*Model|schema\s*=|CREATE TABLE
```

## 3. Business Logic
```bash
Glob: **/services/**/*.{ts,js,py,java}
Grep: async function|export class|def |func 
```

## 4. Authentication & Security
```bash
Glob: **/auth/**/*
Glob: **/guards/**/*
Glob: **/middleware/**/*
Grep: @Guard|middleware|passport|jwt|bcrypt|argon2|auth|authorize
```

## 5. External Integrations
```bash
Grep: fetch\(|axios\.|HttpService|request\(|http\.Get|requests\.
Glob: **/integrations/**/*
Glob: **/clients/**/*
```

## 6. Configuration
```bash
Glob: **/*.config.{ts,js}
Glob: **/.env*
Glob: **/config/**/*
Glob: **/application*.{yml,yaml,properties}
```

## Quick Reference

| Pattern | Purpose |
|---------|---------|
| `**/main.*` | Entry points |
| `**/routes/**/*` or `@Controller` | API surface |
| `**/models/**/*` or `@Entity` | Data model |
| `**/services/**/*` | Business logic |
| `**/auth/**/*` | Security boundary |
| `fetch(` / `axios.` | External calls |
