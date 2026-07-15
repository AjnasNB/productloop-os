# Security

`ajnas-policy` is a local policy evaluation library. It does not contact networks, execute tools, publish artifacts, or persist data by itself.

Recommended use:

- Treat policy bundles as controlled configuration and review changes like source code.
- Keep `defaultEffect` as `deny` for high-risk runtimes.
- Require human review for external publishing, filesystem write, network egress, secrets handling, and customer-visible provenance export.
- Store policy decision ledger events in append-only storage when they support compliance evidence.
- Rotate approval authority and review policy bundles on a fixed cadence.

Report vulnerabilities privately to the Ajnas maintainers. Do not publish exploit details until a fix is available.
