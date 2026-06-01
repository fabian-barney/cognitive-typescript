# @barney-media/cognitive-typescript-core

Core analysis engine for computing Cognitive Complexity on TypeScript projects.

## Install

```bash
npm install --save-dev @barney-media/cognitive-typescript-core
```

## API

```ts
import {
  analyzeProject,
  COGNITIVE_COMPLEXITY_THRESHOLD,
  formatAnalysisReport,
  parseFileMethods
} from "@barney-media/cognitive-typescript-core";

const result = await analyzeProject({
  projectRoot: ".",
  changedOnly: true,
  excludes: ["packages/generated/**"],
  threshold: 12
});

console.log(
  formatAnalysisReport(result.metrics, {
    format: "json",
    threshold: result.threshold,
    exclusionAudit: result.exclusionAudit
  })
);
console.log(result.maxCognitiveComplexity);
console.log(COGNITIVE_COMPLEXITY_THRESHOLD);
console.log(result.exclusionAudit);
```

Key exports:

- `analyzeProject`
- `runCli`, `parseCliArguments`, `usage`
- `parseFileMethods`
- `formatAnalysisReport`, `formatReport`, `formatToonReport`, `formatTextReport`, `formatJunitReport`, `sortMetrics`
- `COGNITIVE_COMPLEXITY_THRESHOLD`

The core returns structured metrics suitable for CI quality gates and later automation or agent integrations.

`analyzeProject(...)` supports aligned file-selection and source-exclusion controls:

- `explicitPaths`
- `changedOnly`
- `excludes`
- `excludeNames`
- `excludeDecorators`
- `excludeComments`
- `useDefaultExclusions`
- `threshold`

`AnalysisResult.exclusionAudit` reports discovered, analyzed, and excluded file/function counts plus per-reason tallies. Full reports and JUnit sidecars can publish that audit data directly, while compact agent primary output omits it by default.

JUnit testcases include GitLab-visible metric details in `name` as
`method:lineStart [CC=complexity]` and in testcase-level `system-out`, while
custom properties remain available for consumers that parse them.

The core stays in the static-analysis lane: it does not execute tests, enable coverage, consume Istanbul or LCOV reports, or compute CRAP scores.

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full documentation.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
