# Changelog

## 0.1.3 - 2026-07-17

- Raised peer floors to `ajnas-runtime` and `ajnas-skills-registry` `^0.2.1` for the coordinated ProductLoop patch release.
- Prepared the package for exact tarball, integrity, and provenance verification through npm Trusted Publishing.

## 0.1.2 - 2026-07-15

- Recompute bundle integrity during signature verification, defensively clone signed bundles, and fail closed for non-canonical values, malformed algorithms/signatures/keys, or tampered contents.
- Enforce Ed25519 private/public key types for `KeyObject`, PEM string, and PEM buffer signing and verification inputs.
- Made the provenance export policy deny unrelated tools instead of allowing on a non-match.
- Raised peer floors to `ajnas-runtime` and `ajnas-skills-registry` `^0.2.0`.
- Hardened canonical JSON descriptor checks against inherited `Object.prototype.value` pollution for accessor-backed objects and arrays.

## 0.1.1 - 2026-07-15

- Added the Node.js declaration dependency required by clean TypeScript consumers of the public `node:crypto` and `Buffer` types.

## 0.1.0 - 2026-07-15

- Added append-only `TraceLedger` with replayable SHA-256 receipt chains.
- Added deterministic trace bundle export and verification.
- Added Ed25519 trace bundle signatures.
- Added default redaction for common secret-bearing keys before receipt calculation.
- Added import helpers for Ajnas runtime events and skills-registry audit events.
- Added runtime-compatible provenance export policy.
- Added CLI verification and digest commands.
- Added release docs, security notes, trace bundle spec, fixture, and example workflow.
- Added bounded canonical JSON validation and defensive cloning for trace, bundle, signature, and redaction inputs.
