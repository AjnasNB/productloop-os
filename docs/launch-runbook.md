# ProductLoop Ecosystem Launch Runbook

This runbook coordinates truthful, reversible launches for Maqam, Cockroach
Crawler, Qarinah, and ProductLoop OS. It is a release gate, not announcement
copy. Each public post must link to evidence that a signed-out user can verify.

## Product Map

| Product | One-sentence role | Launch boundary |
| --- | --- | --- |
| Maqam | Govern registered agent operations with policy, exact approvals, traces, and evidence. | Governance kernel; do not claim control over calls that bypass registered adapters. |
| Cockroach Crawler | Collect bounded public-source records for agent workflows. | Collection connector; do not call a prerelease stable or promise access around login, paywall, robots, or provider restrictions. |
| Qarinah | Compile consented, provenance-linked agent activity into small cited context packs. | Context and memory layer; do not enable capture without machine-local trust or publish before the license decision. |
| ProductLoop OS | Compose the public packages into reviewable product and agent workflows. | Umbrella and adapters; keep package ledgers and trust boundaries explicit. |

The long-term direction is a cross-platform governed agent control plane for
Linux, macOS, and Windows. The near-term product is user-space software; do not
describe it as replacing or converting a host operating system.

## Non-Negotiable Launch Gates

Every release must satisfy all applicable gates before an announcement:

1. The exact source commit is merged to the default branch and the temporary
   working branch is deleted.
2. Required CI is green on the supported operating systems and Node versions.
3. The package version is new and unpublished. Never overwrite or relabel an
   immutable npm version.
4. The packed filename, byte size, SHA-256, npm integrity, registry, publish
   command, and full Git commit are recorded before approval.
5. Publishing uses the repository's protected trusted-publishing workflow and
   registry provenance; reusable npm tokens are not copied into scripts.
6. Git tags and GitHub releases are created only after the registry artifact is
   verified. The tag, registry `gitHead`, and approved commit must agree.
7. Website copy describes the actual registry and GitHub state. Historical
   proof media remains labeled with the version it demonstrates.
8. A signed-out browser smoke test verifies the public landing page, install
   command, documentation, release link, proof media, captions, and 404 path.
9. Security, license, privacy, provider-terms, rate-limit, and credential-class
   boundaries are visible before users install or enable an integration.
10. A rollback or correction owner is available for the first 24 hours.

## Required Decisions Before Qarinah Is Public

Qarinah remains private and unlicensed until its commercialization model is
chosen. These two goals cannot both be guaranteed by one license:

- OSI open source permits commercial use.
- A license that prohibits commercial use is source-available, not open source.

The recommended open-source route is AGPL-3.0-or-later for future Qarinah
releases, a separately registered product trademark, a contributor agreement,
and an optional commercial license for organizations that do not want AGPL
obligations. If commercial use must be prohibited, choose a lawyer-reviewed
source-available license and describe it accurately. Existing MIT releases in
the ecosystem remain usable under the MIT terms under which they were received.

## Staged Release Order

Do not announce every repository at once. Each stage should produce evidence
and feedback for the next stage.

### Stage 1: Maqam

- Publish the next approved patch that fixes immutable npm README drift.
- Deploy the matching website after the package and GitHub release are real.
- Demonstrate one denied call, one exact one-use approval, one no-key web-search
  route, and one public YouTube caption route through `ToolGateway`.
- Phrase the capability as selected governed public research, not unrestricted
  access to the entire internet.

### Stage 2: Cockroach Crawler

- Keep the stable `latest` line and the `next` prerelease line visibly separate.
- Publish another prerelease only from an approved exact artifact; never promote
  an alpha merely to refresh documentation.
- Demonstrate bounded crawling, normalized `SourceRecord` output, source
  conformance, SSRF denial, and serverless dry-run checks.

### Stage 3: Qarinah Technical Preview

- Resolve the license and trademark gate, then make the repository public.
- Publish only after tamper, rollback, consent, path, redaction, concurrency,
  type-consumer, and cross-platform CI checks pass.
- Demonstrate a cited, token-budgeted context pack rebuilt from a consented
  append-only ledger. Never market it as hidden surveillance or perfect memory.
- Ask users to review hooks, grant workspace trust, and start a new agent task;
  do not silently activate capture during installation.

### Stage 4: ProductLoop OS Composition

- Show Maqam governing a registered operation, Cockroach producing a normalized
  record, Qarinah preserving its cited context, and ProductLoop orchestrating
  the workflow through public adapter contracts.
- Verify that composition does not merge independent ledgers or bypass any
  package's policy and approval boundary.

## Launch Asset Kit

Prepare these artifacts for each stage:

- a 60-90 second proof video with captions and a text transcript;
- a five-minute technical walkthrough;
- an architecture diagram with explicit trust boundaries;
- a reproducible quick start and uninstall path;
- raw benchmark data plus environment fingerprints;
- a threat-model summary and responsible-disclosure link;
- exact registry, GitHub release, documentation, and checksum links;
- three screenshots: first success, approval/denial, and evidence/provenance;
- a limitations section and a dated public roadmap.

## Channel Sequence

1. GitHub release, npm registry, documentation site, and proof media.
2. Founder-authored Show HN submission after personally testing every command.
3. LinkedIn and X posts that show one concrete result and link to the proof.
4. A technical article on DEV Community or Hashnode explaining the trust model.
5. Relevant subreddit or community posts only where self-promotion is allowed;
   adapt the explanation to the community and disclose maintainer affiliation.
6. Product Hunt only after onboarding and issue response are stable.

Do not cross-post identical promotional text, buy engagement, automate comments,
or imply third-party endorsement. Application or fundraising context stays out
of package READMEs, release notes, and technical claims.

### Show HN Founder Checklist

The maintainer writes the final submission in their own voice. Before posting:

- install from the public registry in a clean directory;
- run the exact quick start without repository-only files;
- open every public link signed out;
- state what was built, why it exists, and what is genuinely different;
- state current limitations and what still requires a key, login, or local tool;
- include one command that produces a useful result in under five minutes;
- remain available to answer technical questions and correct mistakes.

## Claim Rules

Prefer verifiable statements:

- "No developer key is required for this named public route."
- "This exact call was policy-checked and the approval was consumed once."
- "This context pack cites the immutable event IDs and hashes it was built from."
- "Stable is 0.2.0; 0.3.0-alpha.1 is available only under `next`."

Avoid unsupported statements:

- "accesses the whole internet";
- "no APIs are used";
- "unhackable", "perfectly secure", or "tamper-proof";
- "the first" or "no competitor exists" without a dated, reproducible study;
- "agent OS" when referring only to a user-space library or CLI.

## First 24 Hours

- Watch install failures, provider availability, security reports, and docs drift.
- Label incoming issues as bug, provider outage, policy question, documentation,
  security, or feature request.
- Publish a correction quickly when live state differs from a claim.
- Roll back a website deployment when copy or downloads are misleading.
- Never unpublish an npm version as a routine rollback; deprecate it with a clear
  replacement and preserve the incident record.
- Record adoption using privacy-preserving public signals: registry downloads,
  successful quick-start reports, issue resolution time, and returning users.

## Definition of a Successful Launch

A launch is successful when an independent user can install the public artifact,
reproduce the core proof, understand the boundary, remove it cleanly, and report
a problem without private coordination. Stars and impressions are secondary to
successful governed runs, cited context reuse, and trustworthy issue handling.
