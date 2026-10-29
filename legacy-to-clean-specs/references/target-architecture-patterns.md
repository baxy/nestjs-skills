# Target Architecture Patterns

Choose based on the extracted domain, team size, and deployment constraints. Document trade-offs.

## Modular Monolith
- Single deployable with clear internal module boundaries
- Best when: team is small–medium, domain is coherent, operational simplicity matters
- Trade-off: easier deployment, still one process

## Hexagonal / Ports and Adapters
- Core domain isolated behind ports; adapters for DB, HTTP, queues, etc.
- Best when: long-lived domain logic, multiple delivery mechanisms expected
- Trade-off: more interfaces up front, excellent testability

## Layered Architecture
- Presentation → Application → Domain → Infrastructure
- Best when: straightforward CRUD-style systems
- Trade-off: simple, can become anemic if not careful

## Modular Services (strangler-friendly)
- Extract high-change or high-risk areas into separate services while the rest stays a monolith
- Best when: incremental migration is required
- Trade-off: operational complexity increases gradually

## Decision Guidance
1. Preserve observed behavior first.
2. Prefer the simplest pattern that solves the diagnosed problems.
3. Document the choice with a short rationale (or full ADR if the user wants it).
4. Call out migration strategy (big-bang cutover, strangler fig, parallel run).
