# Changelog

## 0.1.3 - 2026-07-20

- Dropped the end-of-life Node 20 runtime line; supported runtimes are maintained Node 22 LTS, Node 24 LTS, and Node 26 Current releases.
- Raised peer floors to runtime `^0.2.2`, policy `^0.1.3`, and provenance `^0.1.4` for the coordinated patch.

## 0.1.2 - 2026-07-17

- Raised peer floors to runtime `^0.2.1`, policy `^0.1.2`, and provenance `^0.1.3` for the coordinated ProductLoop patch release.
- Prepared the package for exact tarball, integrity, and provenance verification through npm Trusted Publishing.

## 0.1.1 - 2026-07-15

- Raised release peer floors to runtime `^0.2.0`, policy `^0.1.1`, and provenance `^0.1.2` so the public package graph is installable with the security-boundary releases.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

## 0.1.0 - 2026-07-15

- Added `ajnas.eval.suite.v1` suite validation and deterministic SHA-256 digests.
- Added async suite runner with normalized agent-run artifacts.
- Added assertions for run status, JSON paths, runtime events, policy decisions, approvals, provenance, connector trust, and browser steps.
- Added deterministic eval reports with replay verification.
- Added `EvalAuditLedger` with replayable hash-chained receipts.
- Added `ajnas-evals` CLI commands: `validate`, `digest`, `run`, and `verify-report`.
- Added release governance fixtures, runnable example, docs, security notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for suites, artifacts, reports, and audit records.
