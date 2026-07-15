# Security

`ajnas-provenance` provides tamper-evident receipts. It does not provide encrypted storage, key custody, identity proofing, or external timestamping by itself.

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
