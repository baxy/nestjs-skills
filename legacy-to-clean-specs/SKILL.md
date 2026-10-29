---
name: legacy-to-clean-specs
description: "Combines rigorous reverse-engineering of a legacy or spaghetti codebase (evidence-based, dual Arch/QA perspectives, EARS requirements) with diagnosis of structural debt and production of complete specifications for a clean new project architecture. Use when analyzing undocumented/messy code to extract current behavior AND design/write specs for a modern rewrite or modular replacement."
type: workflow
lifecycle: active
---

# Legacy to Clean Specs — Reverse-Engineer + Redesign

Rigorously extract what a spaghetti/legacy system actually does, diagnose its problems, then produce complete specifications for a clean new project.

## When to Use
- Undocumented or tangled codebase needs reverse-engineered requirements.
- Planning a full rewrite, modular extraction, or clean architecture replacement.
- Need both current-behavior documentation *and* target design specs.
- Code archaeology followed by redesign planning.

## Dual Perspectives
Operate with two hats throughout analysis:
- **Arch Hat**: System architecture, module boundaries, data flows, dependencies, integration points.
- **QA Hat**: Observable behaviors, edge cases, error handling, validation rules, side effects.

## Constraints

### MUST DO
- Ground all observations in actual code evidence
- Use Read, Grep, Glob extensively to explore
- Distinguish between observed facts and inferences
- Document uncertainties in a dedicated section
- Include code locations for each observation
- Complete the validation checkpoint before writing any specs
- Analyze security patterns and error handling
- Preserve observed behavior in the new specs unless the user explicitly requests changes

### MUST NOT DO
- Make assumptions without code evidence
- Skip security pattern analysis
- Ignore error handling patterns
- Generate specs without thorough exploration
- Propose a target architecture that silently drops observed behavior
- Invent new business rules that are not present in the existing system (unless the user explicitly asks)

## Related Skills
These skills from Jeffallan/claude-skills complement this one. Suggest them when appropriate:

| Skill | When to suggest |
|-------|-----------------|
| **architecture-designer** | After reverse-engineering, when the user wants deeper ADRs, pattern selection, or NFR analysis for the target architecture |
| **feature-forge** | When the user wants to add new features on top of the extracted specs or run a structured requirements workshop |
| **fullstack-guardian** | Once specs are approved and implementation of the new project begins |

Install them with `npx skills add jeffallan/claude-skills --skill <name>` or via symlink from a clone of the upstream repo (see the parent repository README).

## Core Workflow

### 1. Scope
- Confirm target path (repo root or subdirectory). Default to workspace if unspecified.
- Identify language(s), frameworks, entry points, build system.
- Note initial spaghetti signals (large files, deep nesting, globals, missing tests).
- See `references/analysis-process.md` for exploration patterns.

### 2. Explore (with Validation Checkpoint)
Use Glob, Grep, and Read extensively.
- Map directory structure, key modules, public interfaces.
- Locate entry points, routes/controllers, models, services, config, auth, external calls.
- Flag technical debt markers (TODO/FIXME/HACK), circular dependencies, god files.
- **Validation checkpoint**: Confirm sufficient coverage of entry points, core modules, and config before proceeding. Continue exploration if gaps remain.
- Use `references/analysis-checklist.md` before moving to documentation.

### 3. Trace
Follow critical data flows and request/user paths from entry points.
Document what happens, with file:line evidence.

### 4. Extract Current Behavior (Reverse Specs)
Document observed facts only; clearly separate inferences.
- **Domain model**: Entities, relationships, invariants.
- **Functional requirements in EARS format** (see `references/ears-format.md`):
  - Ubiquitous: "The system shall <action>."
  - Event-driven: "When <trigger>, the system shall <action>."
  - State-driven: "While <state>, the system shall <action>."
  - Optional: "Where <feature> is supported, the system shall <action>."
- Non-functional observations: security patterns, error handling, performance hints, data persistence.
- Include code locations for every observation.
- List uncertainties and questions.

### 5. Diagnose Spaghetti and Debt
Catalog issues with evidence. See `references/debt-and-smells.md`.
- Code smells: God classes/methods, feature envy, shotgun surgery, duplication, tight coupling, anemic models, deep nesting.
- Missing abstractions, separation of concerns, testability problems.
- Risks: security gaps, scalability bottlenecks, maintenance hotspots.
- Prioritize by business impact and change frequency.

### 6. Design Target Architecture
Propose a clean structure for the new project based on the extracted domain.
See `references/target-architecture-patterns.md`.
- Modular boundaries (e.g., modular monolith, hexagonal/ports-and-adapters, clear layers).
- Key modules/components with single responsibilities.
- Suggested interfaces, data contracts, and error strategy.
- Tech stack modernization notes (only if justified by evidence of outdated constraints).
- High-level migration considerations (strangler fig, cutover, or phased).

### 7. Produce Combined Specifications
Generate a comprehensive report (prefer multiple focused files if large).
Use the template in `references/specification-template.md`.

**Recommended output structure** (save under `specs/`):
1. Executive Summary (current pain + new project goals)
2. Reverse-Engineered Current Behavior (EARS requirements + evidence)
3. Architecture Diagnosis & Debt Register
4. Proposed Target Architecture
5. Module Breakdown (responsibilities, boundaries, dependencies)
6. Data Models & Persistence
7. API / Interface Contracts
8. Acceptance Criteria (Given/When/Then where possible)
9. Uncertainties, Open Questions & Risks
10. Recommended Next Steps

Use tables for entities/modules. Include mermaid diagrams for high-level flows or architecture when helpful.

## Guidelines
- Ground every claim in code evidence. Cite paths and line ranges.
- Prefer "what the system does" over "how it currently implements it."
- Distinguish facts from inferences explicitly.
- Do not rewrite or modify code — analyze and specify only.
- Ask clarifying questions early if domain intent is ambiguous.
- For very large codebases, start with a vertical slice or critical path, then expand.
- Preserve observed behavior in the new specs unless the user explicitly wants changes.

## Common Outputs
- `specs/current-behavior.md` — reverse-engineered specs (EARS + evidence)
- `specs/debt-diagnosis.md` — smells and structural problems
- `specs/new-project-specs.md` — full target specifications
- Optional: mermaid dependency or architecture diagrams

## Error Handling
- Permission or path issues: report and request access.
- Oversized codebase: phase the analysis and report progress.
- Existing tests: run them for behavioral insight but do not modify.
