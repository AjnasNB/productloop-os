# Security

## Supported Version

`0.1.x` is an early public release line. APIs may change between minor versions; supported security fixes are documented here.

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
