# @barney-media/cognitive-typescript-karma

Karma adapter for `cognitive-typescript`. It runs Cognitive Complexity analysis after the Karma test run and fails the process when the fixed threshold is exceeded.

## Install

```bash
npm install --save-dev @barney-media/cognitive-typescript-karma karma
```

For a Karma/Jasmine Angular or Ionic app, keep your existing Jasmine and browser launcher packages installed.

## Setup

```js
const { withCognitiveTypescriptKarma } = require("@barney-media/cognitive-typescript-karma");

module.exports = function configureKarma(config) {
  config.set(withCognitiveTypescriptKarma(
    {
      frameworks: ["jasmine"],
      reporters: ["progress", "kjhtml"],
      browsers: ["Chrome"]
    },
    {
      changedOnly: false
    }
  ));
};
```

Supported options:

- `projectRoot`
- `changedOnly`
- `paths`
- `stdout`
- `stderr`

You can also register the plugin manually:

```js
module.exports = function configureKarma(config) {
  config.set({
    plugins: [
      require("karma-jasmine"),
      require("@barney-media/cognitive-typescript-karma")
    ],
    reporters: ["progress", "cognitive-typescript"],
    cognitiveTypescript: {
      paths: ["src"]
    }
  });
};
```

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full details.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
