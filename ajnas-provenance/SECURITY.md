# Security

`ajnas-provenance` provides tamper-evident receipts. It does not provide encrypted storage, key custody, identity proofing, or external timestamping by itself.

`verifyTraceBundleSignature` recomputes bundle and receipt integrity before accepting the Ed25519 signature. Signing requires an Ed25519 private key and verification requires an Ed25519 public key for `KeyObject`, PEM string, and PEM buffer inputs; RSA and EC material is rejected. Non-canonical values and malformed algorithms, keys, encodings, or bundle contents return `false`; callers do not need a separate integrity call to make signature verification meaningful. Signing takes a defensive canonical clone so later caller mutation cannot alter the signed wrapper.

Canonical JSON normalization accepts only own enumerable data descriptors. Accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.

## Expected Controls

- Store trace bundles in append-only or versioned storage.
- Keep Ed25519 private keys outside logs, fixtures, and source control.
- Use `createProvenanceExportPolicy` before external bundle export.
- Treat bundle data as sensitive unless redaction policy and data classification prove otherwise.
- Verify bundles before publishing release evidence or importing them into another audit system.

## Redaction

The ledger redacts common keys including `token`, `secret`, `password`, `apiKey`, `authorization`, `credential`, and `privateKey` before receipts are calculated. Add `redactionKeys` when your organization has additional field names.

## Reporting Issues

Report security issues privately to the Ajnas maintainer before public disclosure. Include the affected version, reproduction steps, and whether a trace bundle or signature was exposed.
