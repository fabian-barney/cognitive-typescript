import { withCrapTypescriptVitest } from "@barney-media/crap-typescript-vitest";

import baseConfig from "./vitest.config";

export default withCrapTypescriptVitest(baseConfig, {
  changedOnly: false,
  failuresOnly: true,
  format: "text",
  junit: false,
  packageManager: "npm",
  paths: ["packages"],
  projectRoot: process.cwd()
});
