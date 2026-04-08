import { withCognitiveTypescriptVitest } from "@barney-media/cognitive-typescript-vitest";

import baseConfig from "./vitest.config";

export default withCognitiveTypescriptVitest(baseConfig, {
  paths: ["packages"],
  projectRoot: process.cwd()
});
