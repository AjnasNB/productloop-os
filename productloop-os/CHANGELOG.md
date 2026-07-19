# Changelog

## 0.2.2 - 2026-07-20

- Dropped the end-of-life Node 20 runtime line; supported runtimes are maintained Node 22 LTS, Node 24 LTS, and Node 26 Current releases.
- Set public Maqam `0.3.1` as the release lock and default clean-consumer target while retaining a separate exact `0.2.4` compatibility-floor test.
- Raised all eight ProductLoop dependency floors to the coordinated patch set and tightened the declared Maqam range to `^0.2.4 || ^0.3.1`.

## 0.2.1 - 2026-07-17

- Raised all eight ProductLoop dependency floors to the coordinated patch release set while retaining the public `maqam@^0.2.4` baseline.
- Added an offline Maqam `0.2.4` adapter-routing and conformance fixture to verify the umbrella integration without accounts, model calls, network requests, or side effects.
- Prepared all nine packages for leaf-first npm Trusted Publishing with exact tarball hashes, integrity, SLSA provenance, and registry signature verification.

## 0.2.0 - 2026-07-15

- Raised all security-patched dependency floors, including Maqam `^0.2.2`.
- Raised the breaking runtime and skills-registry dependency floors to `^0.2.0`.
- Raised `ajnas-evals` to the registry-consistent `^0.1.1` peer-floor patch.
- Made configured Maqam crawler defaults immutable against per-call attempts to broaden network policy or resource ceilings.
- Integrated sanitized policy requests, strict approval semantics, fail-closed signatures, and malformed-policy rejection.

## 0.1.1 - 2026-07-15

- Raised the `ajnas-skills-registry`, `ajnas-provenance`, and `ajnas-browser-research` dependency floors to `^0.1.1` so clean consumers receive their Node.js declaration dependency fixes.

## 0.1.0 - 2026-07-15

- Added named namespaces for Maqam and all eight Ajnas packages.
- Added a deny-by-default `createProductLoopOS()` composition.
- Added runtime-policy, runtime-provenance, skill-provenance, browser-eval, runtime-eval, connector, approval, and Maqam crawler adapters.
- Added a dependency doctor CLI and deterministic end-to-end example.
- Added a live local integration test for the Maqam crawler bridge and registry-backed module verification.
