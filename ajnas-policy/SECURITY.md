# Security

`ajnas-policy` is a local policy evaluation library. It does not contact networks, execute tools, publish artifacts, or persist data by itself.

Bundle validation rejects unknown fields, mistyped criteria, empty criteria, and non-JSON values. Invalid bundles always produce a deny decision, including when their declared default would otherwise allow.

Canonical JSON normalization accepts only own enumerable data descriptors. Accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.

Recommended use:

- Treat policy bundles as controlled configuration and review changes like source code.
- Keep `defaultEffect` as `deny` for high-risk runtimes.
- Require human review for external publishing, filesystem write, network egress, secrets handling, and customer-visible provenance export.
- Store policy decision ledger events in append-only storage when they support compliance evidence.
- Rotate approval authority and review policy bundles on a fixed cadence.

Report vulnerabilities privately to the Ajnas maintainers. Do not publish exploit details until a fix is available.
