# Provenance And License Notes

This package contains original Ajnas implementation code and documentation.

## OSS Research Inspected

Only public npm metadata was inspected during this run:

- `@open-policy-agent/opa-wasm@1.10.0` - Apache-2.0 - `https://github.com/open-policy-agent/npm-opa-wasm.git`
- `casbin@5.51.1` - Apache-2.0 - `https://github.com/apache/casbin-node-casbin.git`
- `@cedar-policy/cedar-wasm@4.11.2` - Apache-2.0 - `https://github.com/cedar-policy/cedar.git`
- `oso@0.27.3` - Apache-2.0 - `https://github.com/osohq/oso.git`

No repositories were cloned. No package source code, examples, documentation, branding, or implementation text was copied.

## Design Takeaways

The Ajnas package uses general policy-engine ideas at the concept level:

- evaluate structured input against policy,
- keep effects explicit,
- separate policy data from runtime execution,
- produce auditable decisions.

The package API, schema, rule matching, receipt ledger, approval queue, CLI, fixtures, and documentation are original Ajnas work.
