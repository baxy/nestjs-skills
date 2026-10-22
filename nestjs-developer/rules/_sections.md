# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Architecture (arch)

**Impact:** CRITICAL
**Description:** Proper module organization and dependency management are the foundation of maintainable NestJS applications. Circular dependencies and god services are the #1 architecture killer.

## 2. Dependency Injection (di)

**Impact:** CRITICAL
**Description:** NestJS's IoC container is powerful but can be misused. Understanding scopes, injection tokens, and proper patterns is essential for testable code.

## 3. Error Handling (error)

**Impact:** HIGH
**Description:** Consistent error handling improves debugging, user experience, and API reliability. Centralized exception filters ensure uniform error responses.

## 4. Security (security)

**Impact:** HIGH
**Description:** Security vulnerabilities can be catastrophic. Input validation, authentication, authorization, and data protection are non-negotiable.

## 5. Performance (perf)

**Impact:** HIGH
**Description:** Optimizing request handling, caching, and database queries directly impacts application responsiveness and scalability.

## 6. Testing (test)

**Impact:** MEDIUM-HIGH
**Description:** Tests are organized by what they need to run (unit, e2e, database, integration). Services are tested through their routes with mocked repositories; database guarantees against a real database.

## 7. Database & ORM (db)

**Impact:** MEDIUM-HIGH
**Description:** Proper database access patterns, transactions, and query optimization are crucial for data-intensive applications.

## 8. API Design (api)

**Impact:** MEDIUM
**Description:** RESTful conventions, versioning, DTOs, and consistent response formats improve API usability and maintainability.

## 9. Microservices (micro)

**Impact:** MEDIUM
**Description:** Building distributed systems requires understanding message patterns, health checks, and inter-service communication.

## 10. Code Style (style)

**Impact:** MEDIUM
**Description:** Team-wide style conventions that apply regardless of framework: comments only where the code cannot say it, the `_` prefix on private methods, no em dash, and US-English spelling.

## 11. DevOps & Deployment (devops)

**Impact:** LOW-MEDIUM
**Description:** Configuration management, structured logging, and graceful shutdown ensure production readiness and zero-downtime deployments.
