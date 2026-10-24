import { withCognitiveTypescriptVitest } from "@barney-media/cognitive-typescript-vitest";
import settings from "./smoke-options.cjs";

export default withCognitiveTypescriptVitest(
  {
    test: {
      include: ["test/**/*.test.ts"],
      reporters: settings.scenario === "explicit" ? [{ onTestRunEnd() { console.log("CUSTOM_REPORTER_FINISHED"); } }] : [],
      coverage: {
        enabled: settings.scenario !== "disabled",
        provider: "v8",
        include: ["src/**/*.ts"],
        reporter: ["json"],
        reportsDirectory: `coverage-${settings.scenario}`
      }
    }
  },
  settings.options
);
