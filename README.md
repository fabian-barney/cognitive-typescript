# cognitive-typescript

`cognitive-typescript` is a shared Cognitive Complexity toolkit for TypeScript projects.

It performs pure static analysis using the Sonar Cognitive Complexity white paper as the metric source of truth, reports the worst function-like bodies first, and fails when any analyzed function exceeds the configured threshold.

## Modules

- `packages/core`: analysis engine, parser, recursion handling, CLI orchestration, and report formatting
- `packages/cli`: executable `cognitive-typescript` package
- `packages/vitest`: Vitest helper and reporter wrapper
- `packages/jest`: Jest helper and reporter wrapper

## Metric and Scope

- The implementation follows the SonarSource Cognitive Complexity white paper.
- It is pure static analysis.
- It does not execute tests, enable coverage, consume Istanbul or LCOV reports, or compute CRAP scores.
- The default threshold is `15`, and the CLI and reporter integrations can override it.

## Build and Test

CI validates the repository on Ubuntu and Windows with Node `22.13.0` and `24.0.0`. Ubuntu enforces the full build, test, gate, and packaging command set; Windows independently validates build/test behavior. Locally, run the full Ubuntu command set before opening or updating a pull request:

```bash
npm ci
npm run build
npm run lint
npm run format:check
npm test
npm run cognitive-typescript-check
npm run crap-typescript-check
npm pack --workspaces
```

`npm run cognitive-typescript-check` runs the repository through its own Cognitive Complexity gate for the published package sources under `packages/`.
`npm run crap-typescript-check` runs the repository through a CRAP gate using the published Vitest adapter for the package sources under `packages/`.
`npm run lint` enforces the repository ESLint baseline.
`npm run format:check` verifies the Prettier-managed source and configuration surface, and `npm run format:write` updates it locally.

## Install

CLI:

```bash
npm install --save-dev @barney-media/cognitive-typescript
```

Vitest adapter:

```bash
npm install --save-dev @barney-media/cognitive-typescript-vitest
```

Jest adapter:

```bash
npm install --save-dev @barney-media/cognitive-typescript-jest jest
```

## Run

From the project root you want to analyze:

```bash
npx cognitive-typescript
```

Changed files only:

```bash
npx cognitive-typescript --changed
```

Explicit files or directories:

```bash
npx cognitive-typescript src/server.ts packages/web
```

## CLI

```text
--help                       Print usage to stdout
(no args)                    Analyze all TypeScript files under any nested src/ tree
--changed                    Analyze changed TypeScript files under src/
<file ...>                   Analyze explicit TypeScript files
<directory ...>              Analyze TypeScript files under each directory's nested src/ tree
--format <format>            Emit toon, json, text, junit, or none (default: toon)
--exclude <glob>             Exclude normalized project-relative paths from analysis (repeatable)
--exclude-name <regex>       Exclude matching function or method names from analysis (repeatable)
--exclude-decorator <name>   Exclude matching decorators by simple or dotted source name (repeatable)
--exclude-comment <marker>   Exclude generated code with leading file/function comment markers (repeatable)
--use-default-exclusions     Enable conservative generated-code exclusions (default: true)
--failures-only[=true|false] Emit failed functions only in the primary report
--omit-redundancy[=true|false]
                             Omit redundant per-method status in the primary report
--output <path>              Write the primary report to a file instead of stdout
--junit-report <path>        Also write a full JUnit XML report for CI test-report UIs
--threshold <integer>        Override the Cognitive Complexity threshold (default: 15)
--agent                      Compact the primary report to actionable failures by default
```

Useful combinations:

```bash
# Compact actionable failures to stdout
npx cognitive-typescript --agent

# JSON primary report plus full JUnit sidecar
npx cognitive-typescript --format json --output reports/cognitive.json --junit-report reports/cognitive-junit.xml

# Generated-code exclusions plus a custom decorator exclusion
npx cognitive-typescript --exclude "packages/generated/**" --exclude-decorator Generated
```

## Core API

```ts
import { analyzeProject, formatAnalysisReport } from "@barney-media/cognitive-typescript-core";

const result = await analyzeProject({
  projectRoot: process.cwd(),
  changedOnly: true,
  excludes: ["packages/generated/**"],
  excludeDecorators: ["Generated"],
  threshold: 12
});

const primary = formatAnalysisReport(result.metrics, {
  format: "json",
  threshold: result.threshold,
  exclusionAudit: result.exclusionAudit
});

console.log(result.thresholdExceeded);
console.log(primary);
```

Common `analyzeProject(...)` options include:

- `projectRoot`
- `explicitPaths`
- `changedOnly`
- `excludes`
- `excludeNames`
- `excludeDecorators`
- `excludeComments`
- `useDefaultExclusions`
- `threshold`

Primary-report formatting and filtering controls such as `format`, `failuresOnly`, and `omitRedundancy` belong to `formatAnalysisReport(...)` or the report-publishing layer, not to `analyzeProject(...)`.

`AnalysisResult` returns:

- `metrics`
- `maxCognitiveComplexity`
- `threshold`
- `thresholdExceeded`
- `selectedFiles`
- `exclusionAudit`
- `warnings`

## Vitest and Jest Adapters

Both reporter integrations stay in the static-analysis lane. They run after the test framework finishes, analyze the selected TypeScript sources, and then decide whether to fail the process based on Cognitive Complexity alone.

Vitest:

```ts
import { defineConfig } from "vitest/config";
import { withCognitiveTypescriptVitest } from "@barney-media/cognitive-typescript-vitest";

export default withCognitiveTypescriptVitest(
  defineConfig({
    test: {
      include: ["test/**/*.test.ts"]
    }
  }),
  {
    changedOnly: true,
    excludes: ["packages/generated/**"],
    format: "text",
    output: "reports/cognitive.txt",
    junitReport: "reports/cognitive-junit.xml",
    threshold: 12
  }
);
```

Jest:

```js
const { withCognitiveTypescriptJest } = require("@barney-media/cognitive-typescript-jest");

module.exports = withCognitiveTypescriptJest(
  {
    testEnvironment: "node"
  },
  {
    paths: ["packages/core", "packages/cli"],
    excludeComments: ["@generated"],
    agent: true
  }
);
```

Reporter options support:

- `projectRoot`
- `paths`
- `changedOnly`
- `excludes`
- `excludeNames`
- `excludeDecorators`
- `excludeComments`
- `useDefaultExclusions`
- `format`
- `agent`
- `failuresOnly`
- `omitRedundancy`
- `output`
- `junit`
- `junitReport`
- `threshold`

Reporter defaults differ from the CLI in two important ways:

- the default primary format is `none`, so reporters stay quiet unless you opt into primary output or `agent`
- the default JUnit sidecar path is `reports/cognitive-typescript/TEST-cognitive-typescript.xml`

Set `junit: false` to disable the sidecar entirely.

## Report Formats

- `toon`: compact line-oriented output with `status`, `threshold`, method rows, and optional exclusion counts
- `json`: structured primary report for automation and scripting
- `text`: human-readable table output
- `junit`: full XML report intended for CI test-report UIs
- `none`: suppress the primary report entirely

`--agent` keeps the primary report compact by default by applying:

- `--format toon`
- `--failures-only=true`
- `--omit-redundancy=true`

## Source Exclusions

Default exclusions stay conservative and generated-code focused:

- declaration files: `*.d.ts`, `*.d.mts`, `*.d.cts`
- generated file names: `*.generated.ts`, `*.generated.tsx`, `*.gen.ts`, `*.gen.tsx`
- generated or build directories: `generated`, `__generated__`, `dist`, `build`, `out`, `coverage`, `node_modules`, `target`, `.next`, `.nuxt`, `.svelte-kit`
- existing test-file defaults such as `__tests__/`, `*.test.*`, and `*.spec.*`
- leading generated-code markers: `@generated`, `<auto-generated`

User-provided exclusions compose with these defaults unless `--use-default-exclusions=false`.

Exclusions are applied before threshold evaluation. Full primary reports and JUnit sidecars can publish exclusion audit counts; compact agent primary output omits that detail by default.

## Changed-file Selection

- `(no args)` analyzes TypeScript files under nested `src/` trees
- explicit files stay explicit
- explicit directories expand to TypeScript files under their nested `src/` trees
- `--changed` uses Git status output and refuses incomplete changed-file detection instead of silently analyzing a partial set
- default generated/build-output directories are pruned during source-root discovery when default exclusions are enabled

## Reporting

- Primary reports describe the selected functions only.
- Full primary reports and JUnit sidecars include exclusion audit counts.
- Compact agent primary reports stay focused on actionable failures and omit exclusion audit detail by default.
- Excluded files and functions are removed before report generation and threshold evaluation.

Report path validation is strict:

- `--output` and `--junit-report` must stay inside the project root
- they must point to files, not the filesystem root, the project root, or an existing directory
- they must not collide with each other, including case-insensitive collisions on Windows and macOS

## Exit Codes

- `0` success, threshold respected
- `1` invalid CLI usage or execution failure
- `2` Cognitive Complexity threshold exceeded (`> threshold`)
- `3` unexpected internal error

## Compatibility Matrix

Verified and unverified syntax shapes are tracked in [docs/compatibility-matrix.md](docs/compatibility-matrix.md). The matrix is backed by fixtures under `tests/fixtures/compatibility-matrix/`.

Cognitive Complexity scoring for `&&`, `||`, `??`, optional chaining, logical assignment, and JSX short-circuit rendering is documented in [docs/operator-semantics.md](docs/operator-semantics.md).

## Release

The default release path uses npm Trusted Publishing from `.github/workflows/release.yml`. Tag `v<version>` from `main` after the build workflow is green. The tag-triggered release workflow verifies package versions, renders the GitHub release notes from `CHANGELOG.md`, runs `npm test`, `npm run cognitive-typescript-check`, and `npm run crap-typescript-check`, then publishes the four public npm packages and creates the GitHub release.

`v0.1.0` was the one-time bootstrap release that used the GitHub repo `NPM_TOKEN` secret together with provenance so the package names could be created on npm. Trusted Publishers are now the default for these packages:

- `@barney-media/cognitive-typescript-core`
- `@barney-media/cognitive-typescript`
- `@barney-media/cognitive-typescript-vitest`
- `@barney-media/cognitive-typescript-jest`

The earlier `v0.1.0` bootstrap used a one-time `NPM_TOKEN` secret so the public package names could be created. Trusted Publishing is now the default path and does not require that token.

Release notes can be rendered locally with:

```bash
npm run render-release-notes -- v0.2.1
```

Before tagging a release, also verify the version metadata locally:

```bash
npm run verify-release-version -- v0.2.1
```

## Contributing

See `CONTRIBUTING.md` for the issue-linked branch, commit, and pull-request flow used in this repository.
