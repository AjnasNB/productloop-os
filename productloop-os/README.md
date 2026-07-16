# productloop-os

`productloop-os` is the public umbrella for Maqam and eight small Ajnas governance packages. It gives applications one dependency, stable named namespaces, a deny-by-default composition, explicit schema adapters, a dependency doctor, and a deterministic integration example.

Node.js 20.18.1 or newer is required.

```sh
npm install productloop-os
```

```js
import {
  createProductLoopOS,
  runtime,
  policy,
  approvals,
  provenance,
  browserResearch,
  maqam
} from "productloop-os";

const os = createProductLoopOS({
  policyBundle: {
    schemaVersion: "ajnas.policy.bundle.v1",
    id: "my-policy",
    version: "1.0.0",
    defaultEffect: "deny",
    rules: [
      {
        id: "allow-local-echo",
        effect: "allow",
        reason: "Reviewed local tool",
        match: { toolNames: ["local.echo"], risks: ["low"] }
      }
    ]
  }
});

os.tools.register({
  name: "local.echo",
  description: "Return local structured input",
  risk: "low",
  execute: ({ input }) => input
});

const result = await os.runtime.run({
  name: "hello",
  input: { message: "hello" },
  steps: [
    { id: "echo", run: (context) => context.callTool("local.echo", context.input) }
  ]
});

os.importRuntimeEvents();
console.log(result.status, os.trace.events.length);
```

## Namespaces

- `maqam` — governed workflows, evidence, CLI-agent tools, and HTTP crawling
- `runtime` — ordered policy-gated tool execution
- `skills` — skill manifests, signatures, install policy, and audit
- `provenance` — hash-linked traces, bundles, signatures, and redaction
- `policy` — declarative policy bundles and decision audit
- `evals` — deterministic assertions and verifiable reports
- `connectors` — connector manifests, permission context, and trust
- `approvals` — review tickets, delegation, escalation, and decision adapters
- `browserResearch` — governed research plans, replay, citations, and provenance

These are namespaces, so colliding names such as `AgentRuntime`, `ApprovalQueue`, and `runCli` remain unambiguous.

## Composition and adapters

`createProductLoopOS()` creates independent ledgers and registries plus tested bridges for runtime and skill events into a general trace. It also exposes `createBrowserHarness()` with a shared audit ledger.

The exported `adapters` include:

- an `ajnas-policy` to `ajnas-runtime` policy adapter;
- runtime snapshot and browser report conversions for `ajnas-evals`;
- policy/connector to approval subjects and approval tickets back to runtime decisions;
- connector trust to runtime policy decisions;
- `createMaqamCrawlerTool()`, an explicit high-risk live-network tool that is never registered automatically.

## CLI

```sh
npx productloop-os doctor
npx productloop-os info
npx productloop-os demo
```

`doctor` checks Node.js and package imports. It deliberately does not report live browsers, credentials, model providers, networks, or connector services as healthy because those are not bundled or safe to probe implicitly.

## Capability boundary

This package is not a model, browser engine, hosted crawler fleet, identity system, secret manager, sandbox, database, distributed scheduler, or guarantee of safety. `ajnas-browser-research` includes deterministic replay, not a live browser. Maqam has a real HTTP crawler and process-backed CLI-agent adapters, which require network, command, filesystem, and credential controls at deployment time.

`createMaqamCrawlerTool({ defaults })` treats every supplied default as a deployment-enforced value: per-call input cannot override those network or resource limits. Put seeds and ordinary request-specific fields in tool input; put private-network policy, allowlists, robots behavior, and ceilings in `defaults`.

See the repository's [architecture](https://github.com/AjnasNB/productloop-os/blob/main/docs/architecture.md), [comparison](https://github.com/AjnasNB/productloop-os/blob/main/docs/comparison.md), and [release guide](https://github.com/AjnasNB/productloop-os/blob/main/docs/releasing.md).

The current coordinated release candidate is `productloop-os@0.2.0`.

## License

MIT
