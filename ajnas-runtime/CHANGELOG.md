# Changelog

## 0.2.1 - 2026-07-17

- Prepared the runtime as the leaf package in the coordinated ProductLoop trusted-publishing release set.
- Added no runtime behavior change; this patch provides a fresh immutable npm version for exact artifact and provenance verification.

## 0.2.0 - 2026-07-15

- Removed executable tool callbacks from policy requests and validate all custom policy decisions before execution.
- Bound approval requests to the effective raised risk and reject malformed approval responses fail-closed.
- Marked the policy-request tool projection as a deliberate breaking security boundary and raised dependent runtime floors to `^0.2.0`.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

## 0.1.0 - 2026-07-15

- Added `AgentRuntime` for ordered workflow execution.
- Added `ToolRegistry` with duplicate and unknown tool errors.
- Added policy decisions for allow, deny, and human approval.
- Added approval request/response flow and approval rejection errors.
- Added chained provenance receipts for all runtime events.
- Added `InMemoryProvenanceSink` for tests and adapters.
- Added `FileRunStore` for durable JSON run snapshots.
- Added tests, README, security notes, architecture notes, example workflow, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning at runtime trust boundaries.
- Added deny-by-default policy behavior, declared-risk floors, path-safe non-reusable run IDs, and exact input-bound approval digests.
