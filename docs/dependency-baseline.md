# Runtime and dependency baseline

Maintenance versions refreshed on 2026-10-31 for #97.

Updated on 2026-10-24 for [#91](https://github.com/fabian-barney/cognitive-typescript/issues/91),
on top of compatible-dependency PR #93. Historical changelog entries retain their original release context.

## Support policy

Official support covers maintained Node.js LTS lines and released lines officially scheduled to become LTS.
Node 22, 24, and 26 receive full support on Windows, macOS, and Linux, including Node 26 before its
scheduled LTS transition on 2026-10-28. Use current security patches in each supported line.
See the [Node release schedule](https://github.com/nodejs/Release/blob/main/schedule.json).

Published packages retain `engines.node: >=22.13.0`. This broad expression is an installation floor,
not an official support commitment for EOL, odd-numbered, or otherwise unverified lines.
The private source-build toolchain requires npm 12.2.1 and Node `^22.22.2 || ^24.15.0 || >=26.0.0`,
the intersection of selected direct build-tool requirements, including npm 12, ESLint, and Vitest 5.

Required build, unit-test, and packaged-consumer CI covers Node 22.23.4, 24.22.2, and 26.13.0 on all
three operating systems. Quality, packaging, and release jobs use Node 24.22.2/npm 12.2.1.
Separate Ubuntu consumer checks use npm 11.21.1 to install built archives on Node 22.13.0, 24.0.0,
and 26.0.0 without installing the private source workspace.

## Selected versions and compatibility decisions

| Component | Baseline |
| --- | --- |
| npm / Node definitions | 12.2.1 / 22.20.5 |
| TypeScript | 6.0.3 |
| Vitest / coverage-v8 / Vite | 5.0.5 / 5.0.5 / 8.3.5 |
| Jest / ts-jest | 30.5.2 / 29.4.15 |
| ESLint / typescript-eslint | 10.14.0 / 8.72.1 |
| Prettier / eslint-config-prettier / @eslint/js | 3.9.10 / 10.1.8 / 10.0.1 |
| globals / fast-xml-parser | 17.13.0 / 5.11.2 |
| CRAP Vitest gate | 2.0.0, retaining its native threshold of 6 |
| setup-node | 7.1.0, pinned to its immutable commit |

- TypeScript 7.0.2 does not expose the existing Program, type-checker, symbol, and AST APIs used by the
  analyzer. typescript-eslint requires TypeScript below 6.1; ts-jest requires below 7. Retain TypeScript
  6.0.3 until stable 7.1 API and tooling readiness are evaluated in
  [#90](https://github.com/fabian-barney/cognitive-typescript/issues/90).
- Node definitions intentionally follow the oldest supported runtime rather than latest Node 26 types,
  preventing compilation against APIs absent from Node 22. Runtime tests cover all supported lines.
- The Vitest adapter accepts `^4.0.0 || ^5.0.0`. Isolated consumers install Vitest 4.1.12 and 5.0.5,
  with identically versioned coverage providers and explicit Vite. Jest stays on major 30.
- Cognitive Complexity remains static analysis: coverage is optional, completion callbacks publish once,
  and the threshold remains 8. The CRAP gate retains threshold 6 and supplies its own TOON 4.4 dependency.
- Repository unit tests resolve the core workspace import to its source entrypoint, avoiding duplicated
  source/compiled coverage identities. Coverage includes package sources explicitly; separate packaged
  consumers verify built exports. Regression tests cover empty property names and omitted loop clauses
  exposed by the precise source-only coverage run, without changing production scoring or naming behavior.
- The production analyzer retains its own TOON encoder. Upgrading the development CRAP dependency does
  not change published Cognitive Complexity report fields, serialization, scoring, or exit codes.
- PostCSS requires nanoid `^3.3.20`; the compatible patched resolution is 3.3.20 rather than nanoid 6.
  The redundant nanoid override and obsolete TOON 2.3.1 override have been removed.
- checkout 7.0.1, upload-artifact 7.0.2, download-artifact 8.0.2, and attest 4.2.2 remain current.
  These changes are included in the aligned 1.1.0 release of all four public packages.

## Advisory status

The refreshed workspace audit reports zero vulnerabilities as of this baseline. Re-audit the selected
graph when dependencies change; direct-version freshness does not establish transitive advisory status.

The October 18 assessment recorded sprintf-js through Jest/Istanbul -> `@istanbuljs/load-nyc-config`
-> js-yaml -> argparse. CVE-2026-97058 was rejected on October 12, and GitHub subsequently
[withdrew GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) on October 22.
It is no longer an active residual advisory or audit discrepancy. No incompatible override or Jest downgrade
was used to change that status. The dependency chain remains in Jest's host-tool graph; it is absent from
the assessed core/CLI and Vitest runtime/peer closures.

## Licenses and release artifacts

Vitest, Vite, TOON, and fast-xml-parser retain MIT licenses; TypeScript and the analyzer are Apache-2.0.
The separately installed Vite host-tool graph includes Lightning CSS 1.33.0 and platform bindings under
MPL-2.0, unchanged from the previous graph. Preserve license/notices and corresponding-source availability
when redistributing that component or a bundled host application; this change modifies none of its source.
Its upstream source is [Lightning CSS](https://github.com/parcel-bundler/lightningcss).

Analyzer archives contain their own Apache-2.0 license and external dependency declarations. Dependency
packages retain their licenses and notices. Per-package SBOMs retain locked runtime/peer identities,
package URLs, aliases, and dependency edges, including optional platform components. Unrelated development
tools and the private parent are excluded. Missing/ambiguous roots, duplicate references, incomplete
closures, incorrect archive contents, and checksum mismatches fail verification.

The Node 24/npm 12 packaging job builds archives/SBOMs once. Every consumer job verifies those exact
artifacts with its installed runners; published engine and peer declarations are checked after installation.
Existing provenance/SBOM attestations and trusted-publisher identity remain unchanged. An unchanged-version
main merge is a successful release no-op and does not create tags or publish packages.
