import { readFile } from "node:fs/promises";
import {
  EvalAuditLedger,
  computeEvalSuiteDigest,
  runEvalSuite,
  validateEvalSuite,
  verifyEvalReport
} from "../dist/index.js";

const suite = JSON.parse(await readFile(new URL("../fixtures/release-eval-suite.json", import.meta.url), "utf8"));
const artifactBundle = JSON.parse(await readFile(new URL("../fixtures/release-run-artifacts.json", import.meta.url), "utf8"));

const artifacts = artifactBundle.artifacts;
const validation = validateEvalSuite(suite);
const report = await runEvalSuite(
  suite,
  (testCase) => artifacts[testCase.id],
  {
    generatedAt: artifactBundle.generatedAt,
    generatedBy: "basic-eval-example"
  }
);
const ledger = new EvalAuditLedger({
  clock: () => new Date("2026-07-09T06:31:00.000Z")
});
ledger.record({
  actor: "basic-eval-example",
  action: "eval.suite.completed",
  suite,
  report
});

console.log(
  JSON.stringify(
    {
      valid: validation.valid,
      suiteDigest: computeEvalSuiteDigest(suite),
      reportValid: verifyEvalReport(report).valid,
      failedCases: report.summary.failedCases,
      auditValid: ledger.verify().valid,
      auditEvents: ledger.events.length
    },
    null,
    2
  )
);
