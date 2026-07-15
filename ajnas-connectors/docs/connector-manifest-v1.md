# Connector Manifest v1

Schema version: `ajnas.connector.manifest.v1`

## Required Fields

- `id`: lowercase connector id using letters, digits, dots, and hyphens.
- `version`: semantic connector manifest version.
- `name`: human-readable connector name.
- `description`: operational description.
- `kind`: `mcp`, `rest`, `browser`, `search`, `crawl`, `github`, `npm`, `publish`, or `custom`.
- `publisher`: owner metadata.
- `runtime`: transport metadata.
- `auth`: auth mode and secret references.
- `permissions`: declared resources, operations, destinations, data classes, and risk.
- `capabilities`: callable capability metadata.
- `trust`: license, review status, source, sandbox, provenance, and attestations.

## Operations

Supported operations are `read`, `write`, `execute`, `search`, `crawl`, `publish`, and `delete`.

`publish` and `delete` permissions must be high or critical risk. Capabilities using those operations must set `requiresApproval: true`.

## Data Classes

Supported data classes are `public`, `internal`, `confidential`, `personal`, `credential`, and `secret`.

`credential` and `secret` data classes must be high or critical risk and are approval-gated by the default trust evaluator.

## License Policy

Connector manifests must declare one of:

- `MIT`
- `Apache-2.0`
- `BSD-2-Clause`
- `BSD-3-Clause`
- `ISC`

This keeps the Ajnas product loop aligned with permissive OSS review constraints.

## Policy Hints

`policyHints.approvalRequiredFor` and `policyHints.deniedFor` are selectors over operations, capabilities, data classes, destinations, and risks. They do not replace an enterprise policy engine; they provide manifest-local safety intent that `evaluateConnectorTrust` can honor.
