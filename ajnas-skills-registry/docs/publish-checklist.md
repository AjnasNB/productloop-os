# ajnas-skills-registry Publish Checklist

`ajnas-skills-registry@0.1.1` was authorized for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

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

The `0.1.1` patch release is authorized. Preserve the approval date, target, and exact version in the release evidence.

## Publish Command

Run only after approval and npm authentication are confirmed:

```bash
npm publish --access public
```

## Post-Publish Evidence

Record:

- npm package URL
- published version
- git commit or source snapshot
- package tarball file list from dry run
- verification command output
- approval timestamp and approver identity
