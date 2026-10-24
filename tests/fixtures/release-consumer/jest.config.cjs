const { withCognitiveTypescriptJest } = require("@barney-media/cognitive-typescript-jest");
const settings = require("./smoke-options.cjs");

module.exports = withCognitiveTypescriptJest(
  {
    testEnvironment: "node",
    testMatch: ["<rootDir>/test/**/*.test.cjs"],
    reporters: settings.scenario === "explicit" ? ["./custom-reporter.cjs"] : [],
    transform: {
      "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "CommonJS", target: "ES2022", isolatedModules: true } }]
    },
    collectCoverage: settings.scenario !== "disabled",
    collectCoverageFrom: ["src/**/*.ts"],
    coverageReporters: ["json"],
    coverageDirectory: `coverage-${settings.scenario}`
  },
  settings.options
);
