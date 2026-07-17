# Publish Checklist

`ajnas-approvals@0.1.1` was authorized and published to the public npm registry on 2026-07-15. This checklist records that release gate; every later version or different target requires fresh authorization.

## Pre-Publish Verification

Run from the `ajnas-approvals` package directory:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-approvals.js validate fixtures/release-approval.workflow.json
node bin/ajnas-approvals.js digest fixtures/release-approval.workflow.json
node bin/ajnas-approvals.js request fixtures/release-approval.workflow.json fixtures/release-approval-request.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-approvals version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## Recorded Approval

The release evidence records:

- package name: `ajnas-approvals`
- version: `0.1.1`
- target registry: npm public registry
- approver identity
- approval timestamp

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

Record the resulting npm URL, package integrity, git tag, and approval ticket evidence in the release notes.
