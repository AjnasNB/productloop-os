# Security

ProductLoop Workbench is a local operator interface, not an operating-system sandbox or a hosted authorization service.

- The server binds to `127.0.0.1`, accepts only its exact active loopback `Host` authority, and uses a per-process token for API calls.
- Mutation requests require same-origin JSON, and request bodies are capped at 64 KiB.
- Direct browser requests cannot broaden trusted policy, connector, credential, or origin configuration.
- Approval decisions are stored transactionally and an approved record can be consumed once. Canonical inputs reject accessors, ambiguous JSON, cycles, oversized values, and malformed enum fields before storage.
- Consequential operations must still pass through Maqam or another real enforcement boundary. Updating a Workbench record alone does not execute a tool.
- The SQLite database may contain user-entered purpose text, canonical tool input, evidence excerpts, and memory references. Protect the data directory as sensitive project data.
- Workbench stores references to secrets, never secret values. Do not place credentials, cookies, tokens, or private keys in run input or evidence text.
- Optional hosted synchronization is an interface only. This package contains no tenant service, billing backend, identity directory, or remote secret broker.

Report vulnerabilities according to the repository-level `SECURITY.md`.
