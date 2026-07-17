# ajnas-evals

`ajnas-evals` is a deterministic regression harness for enterprise agent infrastructure. It evaluates normalized agent-run artifacts against explicit evidence assertions for workflow status, outputs, tool events, policy decisions, human approvals, provenance validity, connector trust, and browser research steps.

The package is original Ajnas infrastructure. It is designed to sit beside `ajnas-runtime`, `ajnas-policy`, and `ajnas-provenance` without requiring those packages at runtime.

## Install

```bash
npm install ajnas-evals
```

## Quick Start

```js
import { runEvalSuite, validateEvalSuite, verifyEvalReport } from "ajnas-evals";

const validation = validateEvalSuite(suite);
if (!validation.valid) {
  throw new Error(JSON.stringify(validation.issues));
}

const report = await runEvalSuite(suite, async (testCase) => {
  return runArtifacts[testCase.id];
}, {
  generatedAt: "2026-07-09T06:30:00.000Z",
  generatedBy: "release-gate"
});

console.log(report.summary);
console.log(verifyEvalReport(report));
```

## CLI

```bash
ajnas-evals validate fixtures/release-eval-suite.json
ajnas-evals digest fixtures/release-eval-suite.json
ajnas-evals run fixtures/release-eval-suite.json fixtures/release-run-artifacts.json
ajnas-evals verify-report report.json
```

`run` accepts a suite JSON file and a JSON artifact bundle. The bundle can either be a case-id keyed object or an object with an `artifacts` property. If `generatedAt` and `generatedBy` are present in the bundle, they are used in the report.

## Assertion Kinds

- `run.status`: verifies the normalized run status.
- `json.path`: verifies a dot-path inside the run artifact.
- `event.type.count`: verifies runtime event counts.
- `policy.decision`: verifies policy evidence for a tool.
- `approval.status`: verifies human approval state.
- `provenance.valid`: verifies replayable provenance status.
- `connector.trust`: verifies connector trust metadata.
- `browser.step`: verifies browser research or inspection evidence.

## Enterprise Safety Model

Eval reports include deterministic suite and artifact digests. `EvalAuditLedger` can record completed eval runs as hash-chained receipts, allowing later replay checks to detect tampering.

The package does not call external services. Adapters decide how agent workflows are executed and return normalized evidence for evaluation.

Version `0.1.2` is the coordinated trusted-publishing patch for runtime `0.2.x` and the security-patched package graph.
