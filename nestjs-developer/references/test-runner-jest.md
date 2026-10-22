# Jest Setup

Applies when `jest` is in the project's `devDependencies`. It is the runner `nest new` generates for CommonJS projects. The tiers, layout and naming come from `rules/test-organize-by-tier`; this file only covers how Jest implements them.

## One config per tier

Each tier has a config file under `test/` that selects its directory with `testRegex`. A coverage config combines the stack-free tiers as `projects`.

```jsonc
// test/jest-unit.json (jest-e2e, jest-db and jest-integration differ only in testRegex)
{
  "rootDir": "..",
  "moduleFileExtensions": ["js", "json", "ts"],
  "testRegex": "test/unit/.+\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" }, // The @/ alias (see arch-import-boundaries)
  "testEnvironment": "node"
}

// test/jest-coverage.json
{
  "rootDir": "..",
  "projects": ["<rootDir>/test/jest-unit.json", "<rootDir>/test/jest-e2e.json"],
  "collectCoverageFrom": ["src/**/*.ts", "!src/main.ts", "!src/**/*.module.ts", "!src/config/**"]
}
```

```jsonc
// package.json (NestJS 11 and earlier: call `jest` directly instead of the node prefix)
"scripts": {
  "test": "pnpm run test:unit && pnpm run test:e2e",
  "test:unit": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-unit.json",
  "test:e2e": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json",
  "test:db": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-db.json --runInBand",
  "test:integration": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-integration.json --runInBand",
  "test:coverage": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-coverage.json --coverage"
}
```

- `--runInBand` runs one file at a time. The database and integration tiers share state, so they need it.
- Coverage is measured in one run over the stack-free tiers, as `test-organize-by-tier` requires.

## NestJS 12

- NestJS 12 packages are ESM-only. Jest loads them only on **Node 24.9 or later**; older Node versions fail with `ERR_REQUIRE_ASYNC_MODULE`. `nest upgrade` moves Jest to v30, and the generated scripts start Jest through `node --experimental-vm-modules`: keep that prefix.
- `@nestjs/testing` works the same with either runner, so the rule examples apply unchanged.
- Jest stays the runner for a CommonJS project. An ESM project uses Vitest (see `test-runner-vitest.md`) rather than Jest's experimental ESM mode.

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) · [Jest configuration](https://jestjs.io/docs/configuration) · [NestJS migration guide](https://docs.nestjs.com/migration-guide)
