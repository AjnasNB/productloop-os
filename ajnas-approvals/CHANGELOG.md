# Changelog

## 0.1.0 - 2026-07-15

- Added `ajnas.approval.workflow.v1` staged approval workflow validation and deterministic digests.
- Added serializable approval tickets with quorum review, delegation, escalation, expiry, cancellation, and deterministic history.
- Added runtime-compatible approval decision adapter.
- Added policy, connector trust, and package release subject adapters.
- Added `ApprovalAuditLedger` with replayable hash-chained receipts.
- Added `ajnas-approvals` CLI with validation, digest, request, review, and inspect commands.
- Added release workflow fixtures, runnable example, security notes, architecture notes, provenance/license notes, and publish checklist.
- Added exact runtime approval binding, subject-mutation checks, bounded canonical JSON validation, and defensive queue/ledger cloning.
