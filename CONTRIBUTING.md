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

Run the full Ubuntu validation command set before pushing. CI also runs Windows build/test coverage separately to catch path and platform issues:

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

- Ubuntu runs the full build, test, lint, format, and gate command set.
- Windows independently validates the build and test path behavior.
- `npm run cognitive-typescript-check` is the repository self-gate for the published package sources.
- `npm run crap-typescript-check` is the sibling CRAP gate for the same published package sources.

Before merging a release version bump, also run:

```bash
npm run verify-release-version -- v1.0.0
npm run test:release
npm run release:artifacts
npm run release:smoke
```

The release workflow renders GitHub release notes from the dated `CHANGELOG.md` section.
A reviewed version-bump merge starts publication automatically; ordinary merges are a no-op.
See [RELEASING.md](RELEASING.md) for release preparation, artifact verification, and failure recovery.
