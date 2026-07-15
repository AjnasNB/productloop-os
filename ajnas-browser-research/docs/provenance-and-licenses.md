# Provenance and License Notes

This package is original Ajnas code under the MIT license.

No third-party implementation code, examples, documentation, APIs, branding, or repository content were copied into this package.

## OSS Research Checked

Public npm metadata was inspected on 2026-07-13:

- `playwright@1.61.1`: Apache-2.0. Metadata describes a high-level API to automate web browsers.
- `crawlee@3.17.0`: Apache-2.0. Metadata describes scalable crawling and browser automation jobs.
- `@browserbasehq/stagehand@3.6.0`: MIT. Metadata describes an AI web browsing framework focused on simplicity and extensibility.
- `robots-parser@3.0.1`: MIT. Metadata describes a `robots.txt` parser.

These projects informed product requirements around adapter boundaries, replayable traces, crawl/search compliance, and browser-engine neutrality. The Ajnas implementation uses a different package name, API, plan schema, provenance model, policy hooks, approval semantics, CLI, docs, examples, fixtures, and tests.

## Release Provenance

Release fixtures use replay records generated from public metadata summaries. They are designed for deterministic tests and do not fetch live pages.
