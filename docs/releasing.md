# Release process

This monorepo is designed for deliberate, inspectable npm releases. Publishing is a human-authorized external side effect and is not part of the build or test scripts.

## Coordinated release order

`maqam@0.2.2` is the registry-backed crawler floor. For the current coordinated release, publish only after Maqam is public, a clean reviewed commit is available, and explicit authorization is given, in this order:

1. `ajnas-runtime@0.2.0`.
2. `ajnas-skills-registry@0.2.0`.
3. `ajnas-provenance@0.1.2`.
4. `ajnas-policy@0.1.1`.
5. `ajnas-evals@0.1.1` and `ajnas-connectors@0.1.1`.
6. `ajnas-approvals@0.1.1`.
7. `ajnas-browser-research@0.1.2`.
8. `productloop-os@0.2.0`, after every declared dependency resolves from the public registry.

The packages use normal semver dependencies in publishable manifests. Do not publish a manifest containing a local `file:` path, workspace-only alias, or unpublished version.

For later releases, publish only changed packages. Publish dependencies before dependents, and publish `productloop-os` last whenever one of its declared dependency versions changes.

## Per-package gate

From a clean checkout on a supported Node.js version:

```sh
npm ci
npm run verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm view <package>@<version> version
```

Before each publish, inspect identity and tarball contents:

```sh
npm whoami
npm view <package> versions --json
npm pack --dry-run --workspace=<package>
```

Then publish the selected workspace intentionally:

```sh
npm publish --workspace=<package>
```

Each package's `prepublishOnly` lifecycle runs tests and typechecking. Its `prepack` lifecycle rebuilds `dist` so the tarball is produced from the current source. `publishConfig.access` is public. Provenance should be enabled only from a supported trusted-publishing CI identity; this local token-based release must not claim CI provenance it cannot produce.

## Credential rules

- Never write an npm token, recovery code, or bypass credential into a manifest, `.npmrc`, source file, documentation, issue, shell history, test fixture, or CI log.
- Prefer npm trusted publishing for CI. For a local release, use npm's interactive authentication or a short-lived environment-scoped credential.
- If a credential appears in chat, logs, or a command line, rotate it before relying on it.
- Confirm package ownership and account identity immediately before publishing.
- Keep the public publish step distinct from tests; no lifecycle script in this repository calls `npm publish`.

## Post-publish verification

Use a fresh temporary consumer project, install the exact public versions, import every namespace, run `productloop-os doctor`, and execute the deterministic example. Confirm that repository, homepage, bugs, license, files, bin entries, types, and provenance metadata appear correctly in the registry.

If any check fails, stop the sequence. npm versions are immutable; fix the issue, increment the affected version, document the reason, and publish a new version rather than attempting to overwrite the existing one.
