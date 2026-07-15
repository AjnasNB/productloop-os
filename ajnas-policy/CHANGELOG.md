# Changelog

## 0.1.0 - 2026-07-15

- Added `ajnas.policy.bundle.v1` declarative policy bundles.
- Added deterministic bundle digests.
- Added runtime-compatible allow, deny, and require-approval decisions.
- Added deterministic rule selection with deny-over-approval-over-allow precedence.
- Added policy decision audit ledger with replayable SHA-256 receipts.
- Added human review queue for policy exceptions.
- Added `ajnas-policy` CLI with `validate`, `digest`, and `evaluate`.
- Added enterprise release policy fixture, CLI request fixture, runnable example, security notes, architecture notes, policy spec, provenance/license notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for policy, approval-queue, and audit records.
