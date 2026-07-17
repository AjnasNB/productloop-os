# Changelog

## 0.2.1 - 2026-07-17

- Raised the `ajnas-runtime` peer floor to `^0.2.1` for the coordinated ProductLoop patch release.
- Prepared the package for exact tarball, integrity, and provenance verification through npm Trusted Publishing.

## 0.2.0 - 2026-07-15

- Made the install policy deny unrelated tools instead of allowing on a non-match.
- Made approval decisions semantically validated and terminal states immutable.
- Removed executable callbacks from the structural runtime policy request type.
- Enforced canonical Ed25519 signed-manifest envelopes, exact key types, immutable manifest snapshots, and consistent fail-closed verification errors.
- Raised the `ajnas-runtime` peer floor to `^0.2.0` for the metadata-only policy tool contract.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

## 0.1.1 - 2026-07-15

- Added the Node.js declaration dependency required by clean TypeScript consumers of the public `node:crypto` and `Buffer` types.

## 0.1.0 - 2026-07-15

- Added `ajnas.skill.v1` manifest validation for capability, permission, trust, license, and runtime compatibility metadata.
- Added deterministic manifest digests and Ed25519 signed manifest envelopes.
- Added `SkillRegistry` with duplicate conflict protection and optional signature verification.
- Added `SkillAuditLedger` with replayable hash-chained receipts.
- Added `createSkillInstallPolicy` for Ajnas runtime-compatible install gates.
- Added `SkillApprovalQueue` for resumable human review workflows.
- Added `ajnas-skills` CLI with `validate` and `digest` commands.
- Added sample manifest, runnable example, security notes, architecture notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for manifests, queues, registry records, and audit data.
