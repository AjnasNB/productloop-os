# Provenance and License Notes

## OSS Research Input

Prior automation runs inspected permissively licensed public projects in the enterprise agent ecosystem, including agent runtimes, policy/gov tools, eval harnesses, human approval libraries, browser harnesses, and crawl/search infrastructure.

For this package:

- no third-party repository was cloned into `ajnas-runtime`
- no third-party source code was copied
- no third-party documentation or examples were copied
- npm packages installed for local development are dev dependencies only
- the runtime API, implementation, tests, docs, and examples are original Ajnas work

## Runtime Provenance

The runtime emits local chained receipts for each event. The receipt is not a cryptographic signature; it is a tamper-evident hash chain for one run trace. `ajnas-provenance` provides signed evidence bundles and audit export formats, while durable remote ledger storage remains a host concern.
