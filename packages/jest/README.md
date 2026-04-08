# @barney-media/cognitive-typescript-jest

Jest adapter for `cognitive-typescript`. It runs Cognitive Complexity analysis after the test run and fails the process when the fixed threshold is exceeded.

## Install

```bash
npm install --save-dev @barney-media/cognitive-typescript-jest jest
```

## Setup

```js
const { withCognitiveTypescriptJest } = require("@barney-media/cognitive-typescript-jest");

module.exports = withCognitiveTypescriptJest(
  {
    testEnvironment: "node"
  },
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

The package also exports `CognitiveTypescriptJestReporter` for direct reporter registration.

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full details.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
