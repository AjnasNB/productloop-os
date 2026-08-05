# Cockroach Browser interoperability

ProductLoop OS supports two deliberately separate Cockroach Browser paths:

1. a strict, data-only capability snapshot for discovery; and
2. a live, authenticated adapter for real Chromium observations in ProductLoop browser-research plans.

The live adapter implements `open` and `extract` by creating a short-lived,
read-only Cockroach Browser session, requesting a semantic snapshot, converting
the observed text into ProductLoop citations and claims, and closing the session
in success and failure paths.

## Install the packages separately

```sh
npm install productloop-os cockroach-browser
```

`productloop-os` remains MIT licensed and has no required or optional dependency
on the AGPL-licensed Cockroach Browser package. The deployment chooses whether
to install and operate Cockroach Browser, owns its license obligations, and
supplies the authenticated client explicitly.

## Connect ProductLoop to the real browser

Start Cockroach Browser as an authenticated daemon according to its deployment
guide, then give ProductLoop a `BrowserClient`. Keep the bearer token in the
host's secret boundary; do not place it in a research plan, adapter metadata, or
evidence record.

```js
import { BrowserClient } from "cockroach-browser/client";
import {
  checkCockroachBrowserConnection,
  createCockroachBrowserResearchAdapter,
  createProductLoopOS
} from "productloop-os";

const client = new BrowserClient({
  baseUrl: process.env.COCKROACH_BROWSER_URL,
  token: process.env.COCKROACH_BROWSER_TOKEN
});

const connection = await checkCockroachBrowserConnection(client);
if (!connection.capabilityIds.includes("page.snapshot")) {
  throw new Error("The browser daemon does not expose semantic snapshots");
}

const adapter = createCockroachBrowserResearchAdapter({
  client,
  allowedOrigins: ["https://example.com"],
  mode: "headless",
  maxDurationMs: 120_000,
  maxSnapshotChars: 50_000
});

const os = createProductLoopOS();
const report = await os.createBrowserHarness(adapter).run({
  schema: "ajnas.browser.research.plan.v1",
  id: "example-browser-read",
  objective: "Capture the reviewed public source",
  policy: {
    allowedOrigins: ["https://example.com"],
    allowedActions: ["open", "extract"],
    citationRequired: true
  },
  steps: [
    {
      id: "read-source",
      action: "extract",
      purpose: "Read the source through real Chromium",
      url: "https://example.com/research"
    }
  ]
});

console.log(report.status, report.citations);
```

`checkCockroachBrowserConnection()` performs explicit authenticated calls to
the daemon health and capability endpoints. ProductLoop's normal `doctor`
command does not probe browser URLs or credentials implicitly.

## Enforced live-adapter boundary

The adapter applies a second deployment-owned boundary in addition to the
research plan's policy:

- exact HTTP(S) origins are required; wildcards, paths, trailing slashes, and embedded credentials are rejected;
- each `open` or `extract` step receives a fresh session and the session is always closed;
- the session permits only `snapshot` with the `read` effect;
- tabs, actions, duration, snapshot text, history, network retention, and evidence are bounded;
- profiles, cookies, storage, credentials, clipboard, uploads, downloads, JavaScript evaluation, clicks, typing, and raw actions are not exposed;
- the final URL is rechecked against the deployment allowlist after navigation; and
- selector-scoped extraction is rejected because the semantic snapshot endpoint does not promise selector isolation.

Loopback and private-network targets remain disabled by default. A trusted host
may set `allowPrivateNetwork: true` only for a separately reviewed local or
internal deployment. Cockroach Browser still applies its own DNS and session
policy checks.

The host retains daemon startup, token issuance, browser installation, network
controls, process isolation, upgrades, and shutdown. Supplying a client grants
ProductLoop only the methods captured by the adapter's structural interface; it
does not transfer the token or runtime object into workflow records.

## Read the discovery-only snapshot

Applications that only need inventory data can continue to use the static
snapshot without creating a connection:

```js
import { productLoopBrowserCapabilitySnapshot } from "cockroach-browser/productloop";
import { adaptCockroachBrowserCapabilitySnapshot } from "productloop-os";

const snapshot = adaptCockroachBrowserCapabilitySnapshot(
  productLoopBrowserCapabilitySnapshot()
);

console.log(snapshot.schemaVersion);
console.log(snapshot.capabilities);
```

The accepted schema is
`cockroach.productloop-capability-snapshot.v1`. ProductLoop validates the exact
identity, kind, structural-only scope, transport tuple, and authority labels.
It rejects missing, unknown, accessor, duplicate, or changed fields and returns
a detached frozen view. This path performs no health check and grants no
browser authority.

## Consequential browser actions

ProductLoop's live adapter is observation-only. When a workflow must click,
type, upload, download, accept a dialog, use credentials, or otherwise change
state, route that exact action through Cockroach Browser's reviewed Maqam
driver. Maqam governance exists only for calls that enter its registered
gateway with the matching policy, approval, and evidence bindings.

Direct Cockroach Browser SDK, HTTP, CLI, or MCP mutations remain outside Maqam
unless the host routes them through that path. ProductLoop citations record the
observation; they do not turn independent systems into one distributed
transaction.

## Production checklist

- Bind the daemon to loopback unless a reviewed remote deployment uses TLS and its own network controls.
- Store the bearer token in a secret manager or equivalent host-owned boundary.
- Use the smallest exact origin allowlist for each deployment.
- Keep private-network access disabled unless the target is explicitly reviewed.
- Verify `page.snapshot` with `checkCockroachBrowserConnection()` during an explicit readiness check.
- Route mutations through Maqam rather than extending this read-only adapter.
- Retain ProductLoop reports and Cockroach Browser evidence according to the deployment's privacy and retention policy.
