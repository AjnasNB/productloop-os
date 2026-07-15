# Publish Checklist

`ajnas-approvals@0.1.0` was authorized for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

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
- version: `0.1.0`
- target registry: npm public registry
- approver identity
- approval timestamp

## Publish Commands

Run only for the authorized version after all verification passes:

```sh
npm publish --access public
```

Record the resulting npm URL, package integrity, git tag, and approval ticket evidence in the release notes.
