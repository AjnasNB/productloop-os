# Security

Policy engines receive sanitized immutable tool metadata and cannot access a registered tool's execution callback. Runtime-returned policy and approval objects are validated at runtime; TypeScript annotations are not treated as a security boundary.

Canonical JSON normalization accepts only own enumerable data descriptors. Accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.

## Supported Version

`0.2.x` is the current metadata-only policy-boundary release line. APIs may change between minor versions; supported security fixes are documented here.

## Security Model

`ajnas-runtime` is an execution coordinator. It does not sandbox arbitrary code by itself. Production deployments should run high-risk tools in an external sandbox or connector worker and expose them to the runtime through a narrow `ToolDefinition`.

Recommended controls:

- deny external publishing, production deploy, email send, and write actions by default
- require human approval for high-risk and critical tools
- persist provenance events outside the process for audit review
- keep secrets out of workflow input and event data
- run untrusted browser/crawl/code tasks in isolated infrastructure

## Reporting

Until a public security channel is approved, report security issues privately to the project owner and do not publish exploit details.
