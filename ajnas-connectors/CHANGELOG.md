# Changelog

## 0.1.2 - 2026-07-17

- Raised peer floors to runtime `^0.2.1`, policy `^0.1.2`, and provenance `^0.1.3` for the coordinated ProductLoop patch release.
- Prepared the package for exact tarball, integrity, and provenance verification through npm Trusted Publishing.

## 0.1.1 - 2026-07-15

- Reject truthy non-boolean approvals, empty approver identities, malformed comments, and non-JSON resolution metadata.
- Normalized the public CLI bin path.
- Raised peer floors to runtime `^0.2.0`, policy `^0.1.1`, and provenance `^0.1.2`.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

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
