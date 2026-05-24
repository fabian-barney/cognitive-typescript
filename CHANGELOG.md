# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

- No unreleased changes.

## [0.2.0] - 2026-05-24

### Added

- Added aligned CLI, core API, Jest, and Vitest report controls for primary reports, JUnit sidecars, compact agent output, and configurable thresholds.
- Added configurable source exclusions for generated or external TypeScript sources, including path globs, function-name regexes, decorator names, comment markers, and exclusion audit reporting.
- Added stricter file-selection behavior for changed-file analysis, including bounded Git output handling and safer refusal of incomplete changed-file detection.
- Added ESLint and Prettier repository gates together with stricter indexed-access typing.

### Changed

- Hardened parser and source-discovery behavior around fixture-backed compatibility cases and aligned generated/build-output pruning.
- Expanded CI and release validation across Ubuntu and Windows, including release-note rendering and package-version verification.
- Updated repository documentation to reflect the aligned static-analysis-only behavior, report controls, exclusions, and contributor workflow.

## [0.1.1] - 2026-04-10

### Changed

- Switched npm publishing to pure Trusted Publishing.
- Removed token-based publish configuration after npm Trusted Publisher setup.

## [0.1.0] - 2026-04-10

### Added

- Published the initial `@barney-media` package set for the CLI, core library, and Vitest and Jest adapters.
