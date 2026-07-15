# Changelog

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
