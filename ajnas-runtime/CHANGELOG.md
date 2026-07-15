# Changelog

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
