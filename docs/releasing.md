# Release process

Publishing is a human-authorized external side effect. Normal builds, tests, pull requests, Dependabot updates, and merges never publish npm packages.

The canonical lock and default integration tests use public `maqam@0.3.1`; the umbrella declares `^0.2.4 || ^0.3.1` and verifies exact `0.2.4` separately. The old workspace versions are already published and immutable, so this source selects fresh coordinated patches. A selected version remains unpublished until the protected workflow and registry checks succeed.

| Package | Previous public version | Selected patch |
| --- | ---: | ---: |
| `ajnas-runtime` | `0.2.1` | `0.2.2` |
| `ajnas-skills-registry` | `0.2.1` | `0.2.2` |
| `ajnas-provenance` | `0.1.3` | `0.1.4` |
| `ajnas-policy` | `0.1.2` | `0.1.3` |
| `ajnas-evals` | `0.1.2` | `0.1.3` |
| `ajnas-connectors` | `0.1.2` | `0.1.3` |
| `ajnas-approvals` | `0.1.2` | `0.1.3` |
| `ajnas-browser-research` | `0.1.3` | `0.1.4` |
| `productloop-os` | `0.2.1` | `0.2.2` |

## Qualify the Maqam release and compatibility floor

Normal verification installs the registry-backed `maqam@0.3.1` release lock and also proves the exact `0.2.4` compatibility floor in an isolated consumer:

```sh
npm ci
npm run verify
```

The two clean-consumer checks can also be run independently:

```sh
npm run test:consumer-types
npm run test:consumer-types:maqam-floor
```

An exact clean Maqam release-candidate checkout can be tested without committing a filesystem dependency:

```sh
MAQAM_PACKAGE_DIR=/absolute/path/to/clean/maqam-candidate npm run test:consumer-types
```

The candidate test packs Maqam outside this repository, installs it with all nine ProductLoop tarballs in a temporary consumer, typechecks the public declarations, and runs the same offline gateway adapter fixture used for registry releases. It accepts only versions covered by the declared range and removes the temporary consumer afterward.

Do not publish ProductLoop against an unpublished Maqam version or a filesystem link. Before dispatch, confirm the canonical lock resolves exact public `maqam@0.3.1`, the separate `0.2.4` floor test passes, and all nine selected ProductLoop versions are absent from npm.

Dependency install scripts are fail-closed under npm `11.18.0` through `.npmrc` `strict-allow-scripts=true`. The root manifest approves only `esbuild`, a dev-only Vitest/Vite tool currently locked to `0.28.1`; the existing lock entry has no registry URL, so npm cannot express that approval as a version-qualified key. Any lock update that changes the resolved esbuild version or introduces another lifecycle script requires a fresh review before `npm ci` can pass.

## Trusted Publisher configuration

Configure a Trusted Publisher separately on npm for each package:

- `ajnas-runtime`
- `ajnas-skills-registry`
- `ajnas-provenance`
- `ajnas-policy`
- `ajnas-evals`
- `ajnas-connectors`
- `ajnas-approvals`
- `ajnas-browser-research`
- `productloop-os`

Every npm publisher entry must use these exact values:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `AjnasNB` |
| Repository | `productloop-os` |
| Workflow filename | `publish-npm.yml` |
| Environment | `npm-publish` |

Create the GitHub `npm-publish` environment with required maintainer review and deployment restricted to protected `main`. Disable or avoid administrator bypass. The workflow stores no npm token and does not use a recovery code, automation token, `NODE_AUTH_TOKEN`, or repository secret. Revoke any reusable npm credential that has appeared in chat, logs, or shell history.

Only the protected publish job receives `id-token: write`. The unprivileged verify job installs dependencies, runs all tests and audits, builds the packages, creates nine tarballs, checks their exact hashes, and uploads them as a one-day workflow artifact. After environment approval, the OIDC job downloads those same tarballs; it does not install workspace dependencies or run package lifecycle scripts.

## Prepare an exact release

Start from a clean, reviewed `main` commit. Update package versions and changelogs deliberately, then update internal dependency ranges when a dependency version changes. A coordinated run requires a new version for all nine packages.

Run:

```sh
npm install --global npm@11.18.0 --ignore-scripts
npm --version # must print 11.18.0
npm ci
npm run verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run release:manifest
```

The release workflow and local manifest preparation deliberately use npm `11.18.0`. Do not generate the approval manifest with another npm version: npm pack output and tarball bytes are CLI-version-sensitive. `release:manifest` packs the already-built outputs with lifecycle scripts disabled and prints the exact workflow JSON. Each entry contains only `version`, `sha256`, and npm `sha512` integrity. It writes temporary tarballs outside the repository unless `--output <directory>` is supplied.

Before dispatching, confirm that the commit and working tree are exact:

```sh
git status --short
git rev-parse HEAD
```

Open **Actions → Publish npm packages (trusted) → Run workflow** from `main` and supply:

1. `expected_commit`: the full lowercase 40-character output of `git rev-parse HEAD`.
2. `release_manifest`: the complete JSON printed by `npm run release:manifest`.
3. `confirmation`: `publish productloop-os packages from COMMIT`, replacing `COMMIT` with the same full hash.

The verification job must pass before GitHub offers the `npm-publish` environment approval. Review the commit and manifest summary, then use normal **Approve and deploy**. Do not use an administrator bypass.

## Enforced publication order

The protected job publishes and verifies one exact tarball at a time:

1. `ajnas-runtime`
2. `ajnas-skills-registry`
3. `ajnas-provenance`
4. `ajnas-policy`
5. `ajnas-evals`
6. `ajnas-connectors`
7. `ajnas-approvals`
8. `ajnas-browser-research`
9. `productloop-os`

For every package, the workflow verifies registry version, integrity, SLSA provenance, downloaded tarball SHA-256, and installed registry signatures. `productloop-os` is always last.

npm has no multi-package transaction. If a run stops after publishing some leaves, fix the external cause and rerun the same approved commit and manifest. A previously published version is skipped only when its registry integrity, provenance, downloaded SHA-256, and any reported `gitHead` match the approved identity exactly; any difference fails closed.

## Post-release

After all nine registry checks pass:

1. Install the exact public versions in a fresh consumer and run `productloop-os doctor` and the deterministic example.
2. Create signed or annotated Git tags only after npm success.
3. Publish GitHub release notes that list the exact package versions and workflow run.
4. Update website version tables and install commands, then run the website's live checks before deployment.

If registry verification fails, do not attempt to overwrite a version. npm versions are immutable; correct the source, increment the affected version, regenerate the complete manifest, and run a newly reviewed release.
