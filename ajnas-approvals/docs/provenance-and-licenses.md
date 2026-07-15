# Provenance And Licenses

`ajnas-approvals` is original Ajnas implementation work. No third-party source code, examples, documentation, branding, or APIs were copied into this package.

## OSS Metadata Reviewed

Only public npm metadata was inspected during this run:

- `humanlayer@0.17.2-npm`: Apache-2.0. Useful as market context for human-in-the-loop agent approval, not used as an implementation source.
- `@inquirer/prompts@8.5.2`: MIT. Useful context for CLI review ergonomics, not added as a dependency.
- `@modelcontextprotocol/sdk@1.29.0`: MIT. Useful context for connector ecosystems, not added as a dependency.
- `inngest@4.12.1`: Apache-2.0. Useful context for durable workflows and queues, not added as a dependency.

No public repositories were cloned. No npm package was installed as a runtime dependency.

## Ajnas Integration Evidence

The fixture approval request carries policy, connector, and provenance-shaped metadata so release automation can preserve why a ticket was opened. ProductLoop integration adapters can export `ApprovalAuditLedger` receipts into `ajnas-provenance` traces.
