const scenario = process.env.COGNITIVE_SMOKE_SCENARIO;
module.exports = {
  scenario,
  options: {
    paths: ["threshold", "disabled", "excluded"].includes(scenario) ? ["src"] : ["src/safe.ts"],
    excludes: scenario === "excluded" ? ["src/risky.ts"] : [],
    format: "json",
    output: scenario === "error" ? "." : `reports/${scenario}/primary.json`,
    junit: scenario !== "no-junit",
    junitReport: `reports/${scenario}/TEST-cognitive.xml`
  }
};
