# cognitive-typescript

`cognitive-typescript` is a shared Cognitive Complexity toolkit for TypeScript projects.

It performs pure static analysis using the Sonar Cognitive Complexity white paper as the metric source of truth, reports the worst function-like bodies first, and fails when any analyzed function exceeds the fixed threshold of `15`.

## Modules

- `packages/core`: analysis engine, parser, recursion handling, CLI orchestration, and report formatting
- `packages/cli`: executable `cognitive-typescript` package
- `packages/vitest`: Vitest helper and reporter wrapper
- `packages/jest`: Jest helper and reporter wrapper

## Metric

- The implementation follows the SonarSource Cognitive Complexity white paper.
- It is pure static analysis.
- It does not read coverage reports or execute tests as part of the analysis itself.
- The threshold is fixed at `15`.

## Build and Test

```bash
npm ci
npm run build
npm test
npm run cognitive-typescript-check
npm run crap-typescript-check
npm pack --workspaces
```

`npm run cognitive-typescript-check` runs the repository through its own Cognitive Complexity gate for the published package sources under `packages/`.
`npm run crap-typescript-check` runs the repository through a CRAP gate using the published Vitest adapter for the package sources under `packages/`.

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

## CLI

```text
--help                       Print usage to stdout
(no args)                    Analyze all TypeScript files under any nested src/ tree
--changed                    Analyze changed TypeScript files under src/
<file ...>                   Analyze explicit TypeScript files
<directory ...>              Analyze TypeScript files under each directory's nested src/ tree
```

## Exit Codes

- `0` success, threshold respected
- `1` invalid CLI usage or execution failure
- `2` Cognitive Complexity threshold exceeded (`> 15`)

## Compatibility Matrix

Verified and unverified syntax shapes are tracked in [docs/compatibility-matrix.md](docs/compatibility-matrix.md). The matrix is backed by fixtures under `tests/fixtures/compatibility-matrix/`.

## Release

`v0.1.0` is the one-time bootstrap release for the public npm packages. The tag-triggered release workflow uses the GitHub repo `NPM_TOKEN` secret for npm authentication and `--provenance` for supply-chain attestation, while rendering the GitHub release notes from `CHANGELOG.md`.

After `v0.1.0` is published successfully, configure npm Trusted Publishers manually for these packages against `fabian-barney/cognitive-typescript` and `.github/workflows/release.yml`:

- `@barney-media/cognitive-typescript-core`
- `@barney-media/cognitive-typescript`
- `@barney-media/cognitive-typescript-vitest`
- `@barney-media/cognitive-typescript-jest`

The first pure Trusted Publisher release should then be cut as `v0.1.1` by removing `NPM_TOKEN` usage from the workflow while keeping the same workflow filename and `id-token: write` permission. After `v0.1.1` publishes successfully, remove the GitHub repo `NPM_TOKEN` secret.

Release notes can be rendered locally with:

```bash
npm run render-release-notes -- v0.1.0
```

## Contributing

See `CONTRIBUTING.md` for the issue-linked branch, commit, and pull-request flow used in this repository.
