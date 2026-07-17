# Changelog

## 0.1.2 - 2026-07-17

- Raised peer floors to `ajnas-runtime` `^0.2.1` and `ajnas-provenance` `^0.1.3` for the coordinated ProductLoop patch release.
- Prepared the package for exact tarball, integrity, and provenance verification through npm Trusted Publishing.

## 0.1.1 - 2026-07-15

- Added strict runtime validation for policy bundles, match criteria, JSON values, and unknown fields so malformed deny rules cannot fall through to an allow default.
- Reject non-boolean or malformed approval queue resolutions.
- Raised peer floors to `ajnas-runtime` `^0.2.0` and `ajnas-provenance` `^0.1.2`.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

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
