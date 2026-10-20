# NestJS Skills

Two Claude Code skills for NestJS work: `nestjs-developer` writes code to a fixed set of conventions, and `nestjs-reviewer` reviews code against the same conventions. They share one set of rules, so what the developer skill writes is what the reviewer skill expects.

| Skill | Use it to | Entry point |
|---|---|---|
| `nestjs-developer` | Write, generate or refactor NestJS code: modules, controllers, services, DTOs, guards, interceptors, entities, migrations, tests, `main.ts` | [`nestjs-developer/SKILL.md`](nestjs-developer/SKILL.md) |
| `nestjs-reviewer` | Review a NestJS branch, pull request or set of files and report findings with evidence and fixes | [`nestjs-reviewer/SKILL.md`](nestjs-reviewer/SKILL.md) |

Both are at version 1.0.0.

## Contents

- [Repository layout](#repository-layout)
- [Installation](#installation)
- [Usage](#usage)
- [What the conventions cover](#what-the-conventions-cover)
- [nestjs-developer](#nestjs-developer)
- [nestjs-reviewer](#nestjs-reviewer)
- [Testing the skills](#testing-the-skills)
- [Changing a rule](#changing-a-rule)
- [Sources](#sources)

## Repository layout

```
.
├── README.md
├── DECISIONS.md                    # Settled choices; read before reviewing or changing the skills
├── nestjs-developer/
│   ├── SKILL.md                    # Task table and rule index
│   └── rules/
│       ├── _sections.md            # Section order and impact levels
│       ├── _template.md            # Template for a new rule
│       └── <prefix>-<name>.md      # 58 rules
├── nestjs-reviewer/
│   ├── SKILL.md                    # Workflow, severity table, report format
│   └── references/
│       ├── checklist.md            # What to check per area, each item tagged with its rule ID
│       └── anti-patterns.md        # Common problems and their fixes
└── evals/
    ├── nestjs-developer-workspace/
    │   └── evals.json              # 3 coding tasks with assertions
    └── nestjs-reviewer-workspace/
        ├── evals.json              # 4 review tasks with assertions
        └── fixtures/               # The pull requests the reviewer is tested on
```

Eval run outputs (`evals/*/iteration-*/`) are gitignored and stay on the machine that ran them.

## Installation

The reviewer reads the developer's rules through the relative path `../nestjs-developer/rules/`, so **the two folders must stay siblings**. Install both, or the reviewer falls back to its own checklist and says so in its summary.

Personal install (available in every project), by symlinking so a `git pull` updates them:

```bash
git clone https://github.com/baxy/nestjs-skills.git ~/workspace/nestjs-skills
ln -s ~/workspace/nestjs-skills/nestjs-developer ~/.claude/skills/nestjs-developer
ln -s ~/workspace/nestjs-skills/nestjs-reviewer  ~/.claude/skills/nestjs-reviewer
```

Project install (shared with everyone working on one repository): copy both folders into that repository's `.claude/skills/`.

Start a new Claude Code session after installing so the skills are picked up.

## Usage

The skills load on their own when the task matches their description. You can also name them.

```
Add a cancel action to orders: only pending or paid orders can be canceled, with an optional reason.

Use nestjs-reviewer to review this branch against main.

Review the changes in src/order/ before I open the PR.
```

The developer skill reads only the rules listed for the task in its task table, then writes the code. The reviewer works through its checklist, opens the rule behind every finding before reporting it, and returns:

1. Summary
2. Critical issues (must fix)
3. Warnings (should fix)
4. Suggestions (consider)
5. Positive observations
6. Recommendations

Every Critical issue and Warning has a `file:line`, the snippet, a concrete fix and the rule ID (or the tag `no rule` with the input that triggers the defect). The reviewer does not change code unless asked.

## What the conventions cover

**Assumed stack:** NestJS on Express or Fastify, TypeORM on PostgreSQL, `class-validator` and `class-transformer`, `@nestjs/swagger`, Jest with `supertest`, `nestjs-pino`. On a project with a different library for one of these (Prisma, Mongoose, Vitest), the skills keep the project's library and apply the intent of the rule.

The main conventions, in short:

- **Layout:** feature modules with type folders (`controllers/`, `services/`, `dtos/`, `entities/`); singular names in code, plural only in URLs and table names; relative imports inside a module, `@/` across modules.
- **API:** REST routes with `POST /:id/{verb}` actions; param, query and body bound to DTO classes; offset pagination returning `{ result, count, limit, offset }`; every response wrapped as `{ success, statusCode, data, meta }` by an interceptor; the same code runs on Express and Fastify.
- **Errors:** services throw the built-in HTTP exceptions; 400 for invalid input or a broken domain rule, 409 for a clash with existing data; one global exception filter.
- **Security:** global `JwtAuthGuard` and `RolesGuard` with `@Public()` and `@Roles()`; the caller arrives as `@AuthUser() authUser: JwtUser`; Argon2id passwords; `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` and `transform`.
- **Database:** `SnakeNamingStrategy`; named indexes and constraints (`IDX_`, `UQ_`, `CHK_`); migrations only generated from entities, applied as a separate deploy step; `synchronize` hardcoded to `false`.
- **Background work:** BullMQ job schedulers for cluster-wide jobs, `@Cron` only for per-instance work.
- **Tests:** four tiers under `test/` (unit, e2e, database, integration); e2e specs run the real controller and service with mocked repositories, through a `createTestApp()` that shares `configureApp()` with `main.ts`.
- **Style:** `_` prefix on private methods only, no em dash, US English.

The reasons behind these choices, and which ones are still open, are in [`DECISIONS.md`](DECISIONS.md).

## nestjs-developer

`SKILL.md` holds two things: a **task table** that maps a task (new endpoint, entity change, authentication, tests...) to the rule files to read before writing code, and the **rule index**. Each rule file has the reasoning, an incorrect example and a correct example.

| Section | Prefix | Impact | Rules |
|---|---|---|---|
| Architecture | `arch-` | Critical | 9 |
| Dependency Injection | `di-` | Critical | 6 |
| Error Handling | `error-` | High | 3 |
| Security | `security-` | High | 6 |
| Performance | `perf-` | High | 4 |
| Testing | `test-` | Medium-high | 6 |
| Database & ORM | `db-` | Medium-high | 4 |
| API Design | `api-` | Medium | 11 |
| Microservices | `micro-` | Medium | 3 |
| Code Style | `style-` | Medium | 3 |
| DevOps & Deployment | `devops-` | Low-medium | 3 |

## nestjs-reviewer

The reviewer follows four steps: identify the scope (the diff against the base branch, plus what the changed files directly depend on), check each affected area with [`checklist.md`](nestjs-reviewer/references/checklist.md), verify every finding against its rule, and write the report.

| Severity | When |
|---|---|
| Critical | A security hole, data loss or corruption, or code that crashes or breaks an endpoint |
| Warning | Any other rule violation, including the `style-` rules, or a concrete defect no rule covers (tagged `no rule`) |
| Suggestion | An improvement no rule requires |

A few constraints keep reviews useful: returning an entity is not a finding by itself; a project convention that conflicts with a rule is reported once as a Suggestion; on another ORM the `db-` rules are checked for intent, not TypeORM APIs; and a missing companion (a migration for an entity change, an e2e spec for a new endpoint) is reported at full severity with the assumption stated.

## Testing the skills

The skills are tested with evals: realistic tasks, run by a fresh Claude Code agent that has the skill, and graded against written assertions. The eval suite is the regression gate. Run it after changing a rule, and treat the skills as done when it passes with no new false positives, rather than when an open-ended review finds nothing more to say.

### The evals

**`nestjs-developer`** ([`evals.json`](evals/nestjs-developer-workspace/evals.json)): three coding tasks.

| Eval | Task | Checks (examples) |
|---|---|---|
| `eval-1-cancel-order` | Let a customer cancel their own order, with an optional reason, plus e2e tests | `POST /orders/:id/cancel` with `@HttpCode(HttpStatus.OK)`; 400 for a shipped order; `@MaxLength(500)`; e2e spec in `test/e2e/order/`; no hand-written migration (8 assertions) |
| `eval-2-infra-bootstrap` | Wire Postgres, Redis, BullMQ, JWT and a nightly token purge for a service on 3 replicas | `synchronize` hardcoded to `false`; `AUTH_` prefix only; namespace injection; a BullMQ job scheduler, not `@Cron`; hashed refresh tokens; named indexes (8 assertions) |
| `eval-3-signup-login` | Signup and login with argon2 and case-insensitive emails, plus database and e2e tests | Lowercased emails; a named unique constraint tested with a savepoint; 409 on a duplicate; identical 401s; hidden `passwordHash`; `POST /sessions` (9 assertions) |

**`nestjs-reviewer`** ([`evals.json`](evals/nestjs-reviewer-workspace/evals.json)): four pull requests in [`fixtures/`](evals/nestjs-reviewer-workspace/fixtures). Each fixture has a `PR.md` describing the change and the changed files under `src/` and `test/`.

| Eval | Fixture | Purpose |
|---|---|---|
| `eval-1-pr142-planted` | `pr-142-order-cancel` | Planted defects: a public admin delete route, `synchronize` from config, 409 for a state transition, `AUTH0_` variables, a missing `@HttpCode` and `@MaxLength` (11 assertions) |
| `eval-2-pr157-planted` | `pr-157-token-purge-cache` | Planted defects: a plaintext refresh token, `@Cron` on 3 replicas, an unnamed index, a listener without error handling, `CacheModule` in a feature module (8 assertions) |
| `eval-3-pr163-clean` | `pr-163-order-cancel-clean` | A nearly clean PR, for false positives: four known problems must be found (a missing migration, a spread save, per-replica throttling, an untrusted proxy), and nothing that is not a real defect may be reported (11 assertions) |
| `eval-4-pr171-heldout` | `pr-171-user-profile` | Held out: written after the skill was tuned on the other three, to catch overfitting (14 assertions) |

The assertions check both directions. "Flags X" assertions make sure real problems are caught; "Does not flag X" assertions make sure correct code that looks suspicious (a `console.error` in a crash handler, a service method without `authUser`, test helpers in `test/helpers/`) is left alone.

### Running the evals

The evals follow the workflow of the `skill-creator` skill. The easiest way is to ask Claude Code from the repository root:

```
Run the evals in evals/ for both skills with the skill-creator workflow, as a new iteration.
```

What that does, so you can also run it by hand:

1. **One run per eval.** For each eval, a fresh subagent gets the skill path and the eval prompt, and writes its result to `evals/<skill>-workspace/iteration-<N>/<eval-name>/with_skill/run-<k>/outputs/`. Developer runs write the generated files at their repository paths plus a `notes.md`; reviewer runs write `review.md` plus a `notes.md` listing the rules they read. Run `eval-3-pr163-clean` three times: false positives vary between runs.
2. **Baseline (optional).** To measure a change, snapshot the skill before editing it and run the same evals against the snapshot into `old_skill/run-<k>/`. For a pure regression check, compare with the previous iteration's results instead.
3. **Metadata and timing.** Each run folder gets an `eval_metadata.json` (the prompt and assertions) and a `timing.json` (`total_tokens`, `duration_ms`) taken from the subagent's completion notice.
4. **Grading.** A grader agent reads each output, checks it against the fixture code, and writes `grading.json`:

   ```json
   {
     "expectations": [
       { "text": "Flags the plaintext refresh token as Critical", "passed": true, "evidence": "Critical: refresh token stored in plain text" }
     ],
     "summary": { "passed": 8, "failed": 0, "total": 8, "pass_rate": 1.0 }
   }
   ```

   For the reviewer, the grader also confirms that every Critical and Warning describes a defect that really exists in the fixture, and that every severity matches the severity table.
5. **Benchmark.** From the `skill-creator` skill folder:

   ```bash
   python -m scripts.aggregate_benchmark <repo>/evals/nestjs-reviewer-workspace/iteration-<N> --skill-name nestjs-reviewer
   ```

   This writes `benchmark.json` and `benchmark.md` with the pass rate, time and tokens per configuration. Without a baseline, its delta column is meaningless.

When an eval's fixture moves, update the absolute path in that eval's prompt in `evals.json`.

### Results so far

| Date | Skill | Iteration | Baseline (old skill) | With skill | Notes |
|---|---|---|---|---|---|
| 2026-10-19 | developer | 1 | 92% | 92% | 3 evals, 3 runs each |
| 2026-10-19 | developer | 2 | 92% | 100% | After the contradiction fixes |
| 2026-10-20 | developer | 3 | not run | 100% (25/25) | Regression check after restoring guidance from the upstream sources; 1 run per eval |
| 2026-10-19 | reviewer | 1 | 66% | 83% | 3 evals, 3 runs each |
| 2026-10-19 | reviewer | 2 | 66% | 91% | |
| 2026-10-19 | reviewer | 3 | 73% | 100% | Held-out `pr-171` added |
| 2026-10-20 | reviewer | 4 | not run | 100% (68/68) | Regression check; the clean PR ran 3 times with no false positives |

The 2026-10-20 runs predate the Swagger envelope, logging and `@SerializeOptions` changes in commit `22ebe9d`.

Known variation between runs, which passes the assertions but is worth watching: a missing migration is sometimes rated Warning instead of Critical, and a `no rule` defect is sometimes reported as a Suggestion.

## Changing a rule

1. Read [`DECISIONS.md`](DECISIONS.md) first. A difference from the upstream sources or from generic NestJS advice that traces to an entry there is intentional.
2. Edit the rule in `nestjs-developer/rules/`, or create one from `_template.md` with the section prefix from `_sections.md`. Keep one incorrect and one correct example.
3. Update `nestjs-developer/SKILL.md`: the rule index line and, if the rule applies to a task, the task table.
4. Add or update the item in `nestjs-reviewer/references/checklist.md`, tagged with the rule ID. If a broken rule should be rated other than Warning, say so in the item.
5. Record the decision in `DECISIONS.md`.
6. Run the checks below, then the evals.

```bash
# No em dashes outside the style rule that bans them
grep -rn '—' nestjs-developer nestjs-reviewer | grep -v style-no-em-dash.md

# Every code fence is closed
for f in nestjs-developer/rules/*.md nestjs-*/SKILL.md nestjs-reviewer/references/*.md; do
  [ $(( $(grep -c '^\s*```' "$f") % 2 )) -ne 0 ] && echo "unclosed fence: $f"
done

# Every rule ID tagged in the reviewer exists
grep -rhoE '\[[a-z]+(-[a-z0-9]+)+\]' nestjs-reviewer | tr -d '[]' | sort -u |
  while read r; do [ -f "nestjs-developer/rules/$r.md" ] || echo "missing rule: $r"; done
```

## Sources

The rules started from two open-source skill collections and were then rewritten around the conventions above:

- [Kadajett/agent-nestjs-skills](https://github.com/Kadajett/agent-nestjs-skills) at `3986e0c`: the base of `nestjs-developer` (40 rules).
- [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) at `fe73fb3`: rules that filled gaps (mapped types, OpenAPI, custom decorators, dynamic modules, guard and interceptor tests) and the original code review skill that became `nestjs-reviewer`.

What was kept, merged, rewritten or left out is recorded in [`DECISIONS.md`](DECISIONS.md).
