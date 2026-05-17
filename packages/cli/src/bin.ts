#!/usr/bin/env node
import { runCli } from "@barney-media/cognitive-typescript-core";

void runCli(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 3;
});
