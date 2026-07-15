# Security

`ajnas-connectors` is governance infrastructure. It does not open network connections, execute connector code, publish packages, or read secrets by itself.

## Trust Boundary

Connector manifests are untrusted input until validated. Treat manifest fields as metadata for review and policy decisions, not as executable authority.

## Approval Boundary

The default trust evaluator requires approval for high and critical risk, write, publish, delete, unreviewed connectors, secret-bearing data classes, and manifest policy hints. External publishing must still wait for explicit user approval outside this package.

## Secret Handling

Manifests should reference secrets by name in `auth.secretRefs`. Do not place token values, API keys, OAuth refresh tokens, private keys, cookies, or passwords in manifests, fixtures, approval records, audit metadata, or CLI output.

## Reporting Issues

Report security issues privately to the Ajnas maintainers. Include the package version, manifest snippet, and exact command or API path involved.
