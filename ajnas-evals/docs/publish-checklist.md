# Publish Checklist

`ajnas-evals@0.1.0` was authorized for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

Before publishing:

1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Run `npm run example:basic`.
5. Run `node bin/ajnas-evals.js validate fixtures/release-eval-suite.json`.
6. Run `node bin/ajnas-evals.js digest fixtures/release-eval-suite.json`.
7. Run `node bin/ajnas-evals.js run fixtures/release-eval-suite.json fixtures/release-run-artifacts.json`.
8. Save the report and run `node bin/ajnas-evals.js verify-report <report.json>`.
9. Run `npm run pack:dry`.
10. Run `npm audit --omit=dev`.
11. Confirm the npm package name and target account.

Publish the authorized version after all verification passes:

```bash
npm publish --access public
```

Use the annotated monorepo release tag rather than separate package tags for the coordinated initial release.
