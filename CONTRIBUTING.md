# Contributing

ProductLoop OS is a TypeScript npm workspace. Contributions should keep package boundaries explicit, behavior deterministic, and high-risk effects opt-in.

## Before opening a pull request

Use [ProductLoop OS Discussions](https://github.com/AjnasNB/productloop-os/discussions) for design questions, integration ideas, usage help, and proposals that need agreement before code is written. Use an issue template for a reproducible bug or a scoped feature request. Report vulnerabilities privately through [SECURITY.md](./SECURITY.md), never through an issue or discussion.

Public contributors should:

1. fork the repository;
2. create a focused branch in the fork;
3. make and verify the change without committing secrets or generated release archives; and
4. submit a pull request against `main`.

Contributors with explicitly granted repository access must still use a non-default branch and a pull request. Do not push changes directly to `main`. Opening a pull request does not grant merge, npm publish, tag, or release authority; those actions are reserved to [the maintainer](./GOVERNANCE.md).

## Development

Use Node.js 20.18.1 or newer and install from the root lockfile:

```sh
npm ci
npm run verify
```

The root lockfile is the canonical development lockfile. The full gate builds and tests every workspace, typechecks public contracts, runs the umbrella integration and CLI doctor, exercises a clean TypeScript consumer, and inspects every npm tarball.

For a focused iteration, run the affected workspace's build, test, and typecheck scripts first. Run the complete root gate before requesting review.

## Package boundaries

The workspace contains independently publishable packages and the `productloop-os` umbrella. Keep dependencies directed through public package APIs. Do not import another package's private source or generated internals, silently merge stores, or create an undocumented cross-package transaction.

When a change affects exported functions, classes, types, schemas, errors, CLI output, package exports, or adapter records:

- describe the compatibility impact in the pull request;
- add clean-consumer or declaration tests when appropriate;
- update the affected package README and changelog;
- preserve JSON-safe boundary rules and deny-by-default behavior; and
- request explicit public-contract review.

## Change requirements

- Add focused tests for behavior and security-boundary changes.
- Preserve deny-by-default behavior and exact approval binding.
- Keep canonical JSON input restrictions consistent across packages.
- Do not add local dependency paths, credentials, generated archives, or unrelated build output.
- Update the affected README, changelog, schemas, and comparison claims.
- Explain filesystem, process, browser, network, credential, notification, approval, or publication effects and test their failure paths.
- Do not weaken input validation, authorization, redaction, provenance, or audit behavior to make a provider integration easier.

## Provider adapters and benchmark claims

A provider-shaped fixture is not a live integration. Adapter contributions must identify what was tested, keep authentication and transport responsibilities explicit, and state which direct client paths would bypass ProductLoop policy or evidence capture. Do not claim an official partnership, native provider support, protocol conformance, production readiness, or end-to-end governance without the corresponding implementation and provider-specific tests.

Deterministic evaluation fixtures are not automatically performance benchmarks, security certifications, capacity measurements, or competitor rankings. Benchmark contributions must include the methodology, environment, sample design, raw machine-readable results, limitations, and commands needed to reproduce the claim. Do not use a project-defined benchmark as evidence of global acceptance or superiority.

## Security and review gates

Changes to policy, approvals, connectors, adapter boundaries, provenance, serialization, browser research, CLI execution, or release code require an explicit security-boundary review. Public API and schema changes require type and public-contract review. A pull request is mergeable only after applicable review comments are resolved and the required CI jobs pass on the supported Node.js matrix.

Never include real tokens, cookies, tenant identifiers, private URLs, private source material, or recovery credentials in source, tests, screenshots, issues, discussions, commits, or workflow logs. Use inert fixtures.

## Versions and npm releases

Do not change package versions, create tags, or publish packages as part of a normal contribution. npm versions are immutable, and releases are performed only by `@AjnasNB` through the human-authorized process in [docs/releasing.md](./docs/releasing.md).

If a maintainer requests a coordinated release change:

- use normal registry semver ranges in publishable manifests;
- never publish a `file:` dependency, workspace-only alias, sibling checkout, or unpublished version;
- publish changed dependencies before their dependents;
- follow the documented sequence for the Ajnas packages; and
- publish `productloop-os` last, only after every declared dependency resolves from the public npm registry.

For the current dependency graph, the family order is: the required public `maqam` version first; then `ajnas-runtime`, `ajnas-skills-registry`, `ajnas-provenance`, `ajnas-policy`, `ajnas-evals` and `ajnas-connectors`, `ajnas-approvals`, and `ajnas-browser-research`; then `productloop-os` last. The exact versions and any future dependency-driven adjustment remain authoritative in [docs/releasing.md](./docs/releasing.md).

If any verification or registry check fails, stop the sequence. Fix the issue in a new version rather than attempting to replace an existing npm version.

## Pull-request review

Keep pull requests focused and fill in the repository template completely. Maintainers may request a smaller change, additional fixtures, security review, type tests, raw benchmark data, or more precise public wording. Approval is not guaranteed, and a review does not transfer ownership or release authority.

Report security issues through the private process in [SECURITY.md](./SECURITY.md), not a public issue.
