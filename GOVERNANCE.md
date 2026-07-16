# Governance

ProductLoop OS is an open-source project with public contribution and maintainer-controlled integration and release decisions.

## Roles

### Contributors

Anyone may discuss ideas, report reproducible defects, fork the repository, create a branch, and submit a pull request. Contribution does not grant repository write access, merge authority, package ownership, npm publication rights, or the right to represent the project publicly.

### Reviewers

The maintainer may ask trusted contributors for technical review. A reviewer can recommend changes or approval but cannot merge, tag, publish, or make a release promise unless this policy is explicitly changed.

### Maintainer and release owner

`@AjnasNB` is the sole maintainer with authority to:

- merge or close pull requests;
- decide the supported public contract and roadmap;
- create repository tags and GitHub releases;
- change npm package versions or publish any workspace package; and
- appoint additional reviewers.

No bot, workflow, contributor, or external service is authorized to publish a package automatically. A future governance change must be reviewed and merged by `@AjnasNB` before any authority changes.

## Contribution path

Public contributors work from a fork and submit a pull request. A contributor with explicit repository access still works from a non-default branch and submits a pull request. Direct changes to `main` are not part of the contribution process.

Use [ProductLoop OS Discussions](https://github.com/AjnasNB/productloop-os/discussions) for questions, integration proposals, examples, and architectural discussion. Use issue templates for actionable bugs and scoped features. Use the private route in [SECURITY.md](./SECURITY.md) for vulnerabilities or sensitive exploit information.

## Decision and merge criteria

The maintainer evaluates a change for scope, maintenance cost, compatibility, security, documentation quality, evidence, and alignment with the project. A pull request may be declined even when its code is functional.

Before merge, the applicable gates must be satisfied:

1. CI passes on the supported Node.js matrix.
2. Focused tests cover changed behavior and meaningful failure paths.
3. Policy, approval, connector, provenance, serialization, browser, CLI, and release-boundary changes receive security review.
4. Exported APIs, TypeScript declarations, schemas, errors, CLI output, and package contents receive public-contract review.
5. Provider-integration and benchmark statements are limited to what the submitted evidence demonstrates.
6. Required documentation and changelogs are current.

`CODEOWNERS` identifies the required owner but is not itself an authorization mechanism. Repository hosting controls may provide additional checks; this document does not change branch protection or GitHub permissions.

## Provider and benchmark integrity

ProductLoop OS supports explicit adapter boundaries; it does not make every provider client safe or governed. A provider-shaped fixture, replay adapter, or interface wrapper must not be marketed as a live, native, official, certified, or production-ready provider integration. Direct paths that bypass policy, approvals, trace, or evidence must be documented.

A deterministic evaluation is not automatically a performance benchmark. Project-defined measurements must publish reproducible methodology, raw results, environment details, and limitations. They must not be presented as global standards, security certification, capacity evidence, or competitor superiority without independent support.

## Release governance

Only `@AjnasNB` may authorize and perform releases. Normal contributions do not change versions or publish packages.

This repository contains independently publishable npm workspaces. Releases must follow [docs/releasing.md](./docs/releasing.md): use registry-safe semver dependencies, publish dependencies before dependents, stop on any failed verification, and publish the `productloop-os` umbrella last after all required versions resolve from the public registry. Existing npm versions are immutable.

## Conduct and disputes

Participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Technical disagreement should be resolved through evidence and the review process. The maintainer makes the final repository and release decision.

## Policy changes

Governance changes use the same pull-request and review path as other public-contract changes. Until a change is merged, this document remains authoritative for repository contribution, merge, and release roles.
