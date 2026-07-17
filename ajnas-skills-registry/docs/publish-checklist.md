# ajnas-skills-registry Publish Checklist

`ajnas-skills-registry@0.2.0` is the current public signed-manifest and policy-contract release. This checklist records its release gate; every later version or different target requires fresh authorization.

## Preflight

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run example:basic
npm run pack:dry
npm audit --omit=dev
npm view ajnas-skills-registry version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## Approval Gate

The selected release is `0.2.0`. Preserve the approval date, target, and exact version in the release evidence when publication is separately authorized.

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

## Post-Publish Evidence

Record:

- npm package URL
- published version
- git commit or source snapshot
- package tarball file list from dry run
- verification command output
- approval timestamp and approver identity
