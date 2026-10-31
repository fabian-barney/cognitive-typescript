# Contributing

All changes in this repository are expected to be issue-linked.

## Workflow

1. Create or confirm the GitHub issue first.
2. Create a branch named `<issue-number>-<slug>`.
3. Reference the issue number in every commit message.
4. Open a pull request that closes the issue.
5. Keep the pull request green, reply to review comments, and resolve threads only after the fix or an explicit invalidation response.
6. Merge only after the latest review is newer than the latest push and all required checks are green.

## Local validation

Use npm `12.2.1` with Node `^22.22.2 || ^24.15.0 || >=26.0.0` for source builds.
Run the full validation command set before pushing. Required CI independently builds, tests, and
executes packaged Vitest 4/5 and Jest consumers on Windows, macOS, and Linux with Node 22/24/26:

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

CI expectations for pull requests:

- Build, unit tests, and packaged consumers run on all nine supported Node/OS combinations.
- Ubuntu runs lint, format, quality gates, and packaging on Node 24.22.2/npm 12.2.1.
- Consumer-minimum jobs use npm 11.15.0 solely to install archives on Node 22.13.0, 24.0.0, and 26.0.0.
- `verify / required` includes every matrix and rejects failed, skipped, or cancelled prerequisites.
- `npm run cognitive-typescript-check` is the repository self-gate for the published package sources.
- `npm run crap-typescript-check` is the sibling CRAP gate for the same published package sources.

Before merging a release version bump, also run:

```bash
npm run verify-release-version -- v1.0.0
npm run test:release
npm run release:artifacts
npm run release:smoke
```

For local packaging when `release-artifacts` already contains files, use a fresh directory:

```bash
npm run release:artifacts -- .temp/my-artifacts
npm run release:smoke -- --artifacts-dir .temp/my-artifacts
```

The smoke harness installs built archives into clean projects and invokes their own Vitest 4/5 and Jest
runners. It verifies public exports, engine/peer metadata, reporter scenarios, report files, and CLI exit codes.

The release workflow renders GitHub release notes from the dated `CHANGELOG.md` section.
A reviewed version-bump merge starts publication automatically; ordinary merges are a no-op.
See [RELEASING.md](RELEASING.md) for release preparation, artifact verification, and failure recovery.
