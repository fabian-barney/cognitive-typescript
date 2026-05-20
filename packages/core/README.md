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
  formatReport,
  parseFileMethods
} from "@barney-media/cognitive-typescript-core";

const result = await analyzeProject({ projectRoot: "." });

console.log(formatReport(result.metrics));
console.log(result.maxCognitiveComplexity);
console.log(COGNITIVE_COMPLEXITY_THRESHOLD);
console.log(result.exclusionAudit);
```

Key exports:

- `analyzeProject`
- `runCli`, `parseCliArguments`, `usage`
- `parseFileMethods`
- `formatReport`, `sortMetrics`
- `COGNITIVE_COMPLEXITY_THRESHOLD`

The core returns structured metrics suitable for CI quality gates and later automation or agent integrations.

`analyzeProject(...)` supports aligned source-exclusion controls:

- `excludes`
- `excludeNames`
- `excludeDecorators`
- `excludeComments`
- `useDefaultExclusions`

`AnalysisResult.exclusionAudit` reports discovered, analyzed, and excluded file/function counts plus per-reason tallies. Full reports and JUnit sidecars can publish that audit data directly, while compact agent primary output omits it by default.

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full documentation.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
