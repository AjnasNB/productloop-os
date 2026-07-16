# Publish Checklist

`ajnas-policy@0.1.1` is the authorized strict-validation security patch for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

## Preflight

```bash
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-policy.js validate fixtures/enterprise-release-policy.json
node bin/ajnas-policy.js digest fixtures/enterprise-release-policy.json
node bin/ajnas-policy.js evaluate fixtures/enterprise-release-policy.json fixtures/publish-request.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-policy version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## Publish Commands

Run only for the authorized version after all verification passes:

```bash
npm publish --access public
```

After publish:

```bash
npm view ajnas-policy version --json
```
