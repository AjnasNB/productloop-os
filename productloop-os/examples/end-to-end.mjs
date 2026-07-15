import { runDeterministicDemo } from "../dist/index.js";

const result = await runDeterministicDemo();
console.log(JSON.stringify(result, null, 2));

if (
  result.runtimeStatus !== "completed" ||
  result.browserStatus !== "passed" ||
  result.evalStatus !== "passed" ||
  result.maqamStatus !== "completed" ||
  !result.traceValid
) {
  process.exitCode = 1;
}
