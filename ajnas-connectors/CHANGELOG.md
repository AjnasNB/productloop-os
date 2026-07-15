# Changelog

## 0.1.0 - 2026-07-15

- Added `ajnas.connector.manifest.v1` connector manifest validation and deterministic digests.
- Added connector trust evaluation with deny and approval precedence.
- Added runtime-compatible policy request generation for connector invocations.
- Added `ConnectorRegistry` with audit integration and deterministic listing.
- Added hash-chained `ConnectorAuditLedger`.
- Added `ConnectorApprovalQueue` for resumable human review workflows.
- Added `ajnas-connectors` CLI with `validate`, `digest`, `trust`, `policy-context`, and `registry-summary`.
- Added release-publishing fixture, runnable example, architecture docs, security notes, provenance notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for manifests, registries, queues, policy context, and audit records.
