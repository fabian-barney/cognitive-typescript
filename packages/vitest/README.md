# @barney-media/cognitive-typescript-vitest

Vitest adapter for `cognitive-typescript`. It runs Cognitive Complexity analysis after the test run and fails the process when the fixed threshold is exceeded.

## Install

```bash
npm install --save-dev @barney-media/cognitive-typescript-vitest vitest
```

## Setup

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
    changedOnly: false
  }
);
```

Supported options:

- `projectRoot`
- `changedOnly`
- `paths`
- `stdout`
- `stderr`

The package also exports `CognitiveTypescriptVitestReporter` for direct reporter registration.

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full details.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
