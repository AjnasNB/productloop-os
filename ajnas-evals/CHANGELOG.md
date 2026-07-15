# Changelog

## 0.1.0 - 2026-07-15

- Added `ajnas.eval.suite.v1` suite validation and deterministic SHA-256 digests.
- Added async suite runner with normalized agent-run artifacts.
- Added assertions for run status, JSON paths, runtime events, policy decisions, approvals, provenance, connector trust, and browser steps.
- Added deterministic eval reports with replay verification.
- Added `EvalAuditLedger` with replayable hash-chained receipts.
- Added `ajnas-evals` CLI commands: `validate`, `digest`, `run`, and `verify-report`.
- Added release governance fixtures, runnable example, docs, security notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for suites, artifacts, reports, and audit records.
