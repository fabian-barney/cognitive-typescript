# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

## [1.0.0] - 2026-10-03

### Added

- Published checksums, per-package CycloneDX SBOMs, and keyless build and SBOM
  attestations alongside the four npm archives, with npm provenance.
- Documented consumer verification and recovery using the original release artifacts.

### Changed

- Released the core, CLI, Vitest, and Jest packages as an aligned stable 1.0.0 set.
- Automated publication from reviewed version-bump merges after exact-commit CI,
  restoring the Ubuntu/Windows build and test matrix and required quality gates.
- Preserved the public APIs, CLI behavior, report formats, default Cognitive
  Complexity threshold of 8, and Node.js requirement of at least 22.13.0.

### Security

- Pinned transitive `@toon-format/toon` to `2.3.1` to resolve the high-severity
  dependency advisory while awaiting a compatible published `crap-typescript` release.
- Updated locked js-yaml, Vitest and its coverage provider, and brace-expansion
  dependencies through reviewed Dependabot changes.

## [0.4.0] - 2026-08-30

### Added

- Exposed the shared reporter analysis runner for adapter integrations.

### Changed

- Centralized Jest and Vitest reporter finalization and adopted the upstream CRAP
  `6.0` default for the repository quality gate.
- Hardened release-note generation and validation.

### Security

- Updated `fast-xml-parser` to `5.11.1` and pinned `nanoid` to `3.3.18` to
  resolve dependency advisories.

## [0.3.0] - 2026-08-09

### Changed

- Reduced the default Cognitive Complexity threshold from `15` to `8`.

### Security

- Refreshed npm lockfile resolutions to resolve seven dependency security
  advisories without changing declared runtime or public API dependencies.

## [0.2.2] - 2026-06-19

### Changed

- Updated vite from 8.0.15 to 8.0.16.

## [0.2.1] - 2026-06-01

### Changed

- Updated compatible npm tooling and CI artifact action versions.
- Hardened function discovery naming for namespace, class, object, class-field, computed-name, and assignment-target edge cases.
- Documented and fixture-pinned Cognitive Complexity operator semantics while preserving existing default scores.

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
