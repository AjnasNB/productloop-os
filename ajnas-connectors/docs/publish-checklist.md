# Publish Checklist

Package: `ajnas-connectors@0.1.1`

`ajnas-connectors@0.1.1` is the authorized approval-validation security patch for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

## Required Verification

Run from the `ajnas-connectors` package directory:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-connectors.js validate fixtures/enterprise-release-publisher.connector.json
node bin/ajnas-connectors.js digest fixtures/enterprise-release-publisher.connector.json
node bin/ajnas-connectors.js trust fixtures/enterprise-release-publisher.connector.json
node bin/ajnas-connectors.js policy-context fixtures/enterprise-release-publisher.connector.json fixtures/publish-invocation.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-connectors version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## External Release Commands

Run only for the authorized version after all verification passes:

```bash
npm publish --access public
```

Create the annotated monorepo release tag from the exact verified source commit.
