# Publish Checklist

`ajnas-policy@0.1.1` was authorized and published to the public npm registry on 2026-07-15. This checklist records that release gate; every later version or different target requires fresh authorization.

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

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

After publish:

```bash
npm view ajnas-policy version --json
```
