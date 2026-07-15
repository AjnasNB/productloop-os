# Provenance and License Notes

This package is original Ajnas implementation work.

## OSS Research Inspected

Only public npm metadata was inspected during this run:

- `@modelcontextprotocol/sdk@1.29.0`: MIT, TypeScript implementation of Model Context Protocol.
- `undici@8.7.0`: MIT, Node.js HTTP client.
- `crawlee@3.17.0`: Apache-2.0, JavaScript crawling and automation library.
- `openapi-fetch@0.17.0`: MIT, type-safe OpenAPI fetch client.

No public repositories were cloned. No third-party source code, examples, documentation prose, package branding, APIs, or implementation details were copied into Ajnas.

## Ajnas Design Outcome

The research reinforced that connector systems need a common control plane across transports. `ajnas-connectors` deliberately avoids transport-specific implementation code and instead provides original Ajnas trust metadata, approval gates, runtime policy context, and audit receipts.

## License

`ajnas-connectors` is MIT licensed.
