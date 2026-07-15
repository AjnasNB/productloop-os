# Architecture

`ajnas-evals` has four boundaries:

1. Eval suites describe expected evidence using `ajnas.eval.suite.v1`.
2. Executors run or replay a case and return an `AgentRunArtifact`.
3. Assertion evaluators compare artifacts against the suite and create an `ajnas.eval.report.v1`.
4. `EvalAuditLedger` records report completion in a replayable hash chain.

The package avoids runtime dependencies. This keeps eval behavior deterministic and makes it suitable for CI, release gates, and offline compliance review.

## Normalized Artifact Model

Artifacts are evidence, not live integrations. They can include:

- Runtime events and tool call summaries.
- Policy decisions and approval records.
- Provenance bundle verification summaries.
- Connector trust metadata.
- Browser inspection steps.

This allows the harness to evaluate agent workflows, MCP/tool calls, browser tasks, and approval workflows without coupling to one execution engine.

## Determinism

Suite digests, artifact digests, report digests, and audit receipts are computed with stable JSON key ordering. Callers can pass a fixed `generatedAt` value for reproducible reports.
