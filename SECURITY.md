# Security policy

## Supported versions

`0.1.x` is the current early public release line. Security fixes are documented in package changelogs and released as new immutable npm versions.

## Reporting a vulnerability

Use the repository's private GitHub security-advisory flow to report a suspected vulnerability. Do not open a public issue containing exploit details, credentials, private targets, or sensitive evidence.

Include the affected package and version, the security boundary involved, a minimal reproduction, impact, and any proposed mitigation. Never include live secrets; replace them with inert test values.

## Scope

ProductLoop OS provides in-process policy, approval, evidence, registry, evaluation, and adapter primitives. It is not a sandbox, identity provider, secret manager, browser isolation boundary, or distributed transaction system. Review [security boundaries](./docs/security-boundaries.md) before deploying tools with filesystem, process, network, credential, or publication access.
