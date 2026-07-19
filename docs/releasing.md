# Release process

Publishing is a human-authorized external side effect. Normal builds, tests, pull requests, Dependabot updates, and merges never publish npm packages.

The canonical lock and default integration tests use public `maqam@0.3.1`; the umbrella declares `^0.2.4 || ^0.3.1` and verifies exact `0.2.4` separately. All eight leaf versions below and `productloop-os@0.2.2` are public and immutable. This source selects only `productloop-os@0.2.3`; a selected source version is not public unless the protected workflow and registry checks succeed.

| Package | Public baseline | Selected source version |
| --- | ---: | ---: |
| `ajnas-runtime` | `0.2.2` | `0.2.2` (unchanged) |
| `ajnas-skills-registry` | `0.2.2` | `0.2.2` (unchanged) |
| `ajnas-provenance` | `0.1.4` | `0.1.4` (unchanged) |
| `ajnas-policy` | `0.1.3` | `0.1.3` (unchanged) |
| `ajnas-evals` | `0.1.3` | `0.1.3` (unchanged) |
| `ajnas-connectors` | `0.1.3` | `0.1.3` (unchanged) |
| `ajnas-approvals` | `0.1.3` | `0.1.3` (unchanged) |
| `ajnas-browser-research` | `0.1.4` | `0.1.4` (unchanged) |
| `productloop-os` | `0.2.2` | `0.2.3` |

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

Do not publish ProductLoop against an unpublished Maqam version or a filesystem link. Before dispatch, confirm the canonical lock resolves exact public `maqam@0.3.1` and the separate `0.2.4` floor test passes. For an umbrella-only patch, the eight selected leaf versions must already exist with the exact approved registry identity and only the new umbrella version should be absent. A protected retry may also encounter the umbrella version, but it is skipped only after the same exact-identity checks.

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

Only the protected publish job receives `id-token: write`. The unprivileged verify job installs dependencies, runs all tests and audits, builds the packages, creates nine tarballs, checks their exact hashes, and uploads them as a one-day workflow artifact. After environment approval, the OIDC job downloads those same tarballs; it does not install workspace dependencies or run package lifecycle scripts. An unchanged leaf is skipped only when its locally rebuilt tarball and downloaded registry tarball have the approved integrity and exact SHA-256 and the registry reports SLSA provenance; a changed package is never hidden behind an old version.

## Prepare an exact release

Start from a clean, reviewed `main` commit. Update package versions and changelogs deliberately, then update internal dependency ranges when a dependency version changes. Only packages whose packed public contents change need a new version. An unchanged leaf may retain its public version only when the trusted Linux builder reproduces its exact registry artifact and the protected workflow verifies its integrity, provenance, and downloaded tarball SHA-256.

Run the local verification gate:

```sh
npm install --global npm@11.18.0 --ignore-scripts
npm --version # must print 11.18.0
npm ci
npm run verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

Do not use a Windows-generated manifest for approval. `npm pack` preserves executable-mode metadata, so raw tarball hashes can differ by platform even at the same commit. Local `npm run release:manifest` is diagnostic only.

Open **Actions → Prepare npm release (trusted Linux) → Run workflow** from `main` and supply:

1. `expected_commit`: the full lowercase 40-character output of `git rev-parse HEAD`.
2. `confirmation`: `prepare productloop-os release from COMMIT`, replacing `COMMIT` with the same full hash.

The preparation workflow binds to that exact `main` commit, installs Node `24.18.0` and npm `11.18.0`, runs the full verification and both audits, and packs all nine packages on Ubuntu with lifecycle scripts disabled. It uploads a one-day artifact containing the canonical compact manifest and tarballs and reports the manifest SHA-256 in the run summary. Each manifest entry contains only `version`, `sha256`, and npm `sha512` integrity.

Before dispatching, confirm that the commit and working tree are exact:

```sh
git status --short
git rev-parse HEAD
```

After reviewing the successful preparation run and downloading its manifest, open **Actions → Publish npm packages (trusted) → Run workflow** from the same `main` commit and supply:

1. `expected_commit`: the full lowercase 40-character output of `git rev-parse HEAD`.
2. `release_manifest`: the complete compact JSON from `release-manifest.json` in the trusted Linux preparation artifact.
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

npm has no multi-package transaction. If a run stops after publishing a package, fix the external cause and rerun the same approved commit and manifest. A previously published package is skipped only when its registry integrity, provenance, and downloaded SHA-256 match the approved identity exactly. npm does not consistently expose `gitHead`; when it does, a reused exact leaf may retain the commit of its earlier publication, while a previously published umbrella must report the approved commit. Any artifact-identity difference fails closed.

## Post-release

After all nine registry checks pass:

1. Install the exact public versions in a fresh consumer and run `productloop-os doctor` and the deterministic example.
2. Create signed or annotated Git tags only after npm success.
3. Publish GitHub release notes that list the exact package versions and workflow run.
4. Update website version tables and install commands, then run the website's live checks before deployment.

If registry verification fails, do not attempt to overwrite a version. npm versions are immutable; correct the source, increment the affected version, regenerate the complete manifest, and run a newly reviewed release.
