# Maqam and ProductLoop OS

[Maqam](https://maqamagent.com) and ProductLoop OS are one open-source ecosystem with two distinct jobs.

| Layer | Job | Use it when |
| --- | --- | --- |
| ProductLoop Workbench | Local operator control center for durable runs, exact approval review, evidence, memory links, policy inspection, and proof export | One developer needs to operate and inspect the public stack from a loopback-only dashboard without adopting a hosted account |
| Maqam | Governed execution kernel that binds policy, exact approvals, tool execution, and source-linked evidence | A side effect must execute through an approval- and evidence-aware gateway, or an application needs Maqam's workflow, CLI-agent, skill, or HTTP-crawler capabilities |
| ProductLoop packages | Composable surrounding capabilities for runtime orchestration, declarative policy, approval operations, provenance, connectors, skill manifests, evaluations, and browser-research records | An application wants small packages with explicit records and interfaces, independently or alongside Maqam |
| `productloop-os` | Umbrella package that exposes Maqam and all eight Ajnas namespaces, creates both subsystems, and supplies a small set of tested adapters | An application wants one install and a coordinated composition without hiding package boundaries |

## Which package to install

Install Maqam when the governed execution kernel is the primary requirement:

```sh
npm install maqam
```

Install the ProductLoop umbrella when the application needs Maqam plus the surrounding package ecosystem:

```sh
npm install productloop-os
```

Each Ajnas package can also be installed independently. The [package atlas](https://maqamagent.com/docs/productloop/) lists their responsibilities and copy-paste examples.

`productloop-workbench@0.1.0` is currently a source candidate in this monorepo. It depends on the published `productloop-os@^0.2.3` package and keeps Qarinah, Cockroach Browser, and Cockroach Crawler optional. Do not advertise its npm install command until protected publication is complete.

## What Workbench adds

Workbench owns a single-operator SQLite database and loopback UI for the records around a governed operation. Approval consumption is transactional and one-use. A dashboard decision does not execute an external operation: the host must still verify the exact binding and dispatch the real effect through Maqam or another enforcement boundary.

The open-source package exports an interface for team synchronization but contains no hosted implementation. SSO/RBAC, managed workers, multi-tenant storage, centralized reviewer identity, billing, and enterprise retention remain a separately reviewed private control-plane boundary.

## What the umbrella actually composes

`createProductLoopOS()` creates an `ajnas-runtime` subsystem with ProductLoop policy, approval, skill, connector, browser-research, and provenance components. It also creates a separate Maqam policy engine, evidence ledger, approval queue, tool gateway, and runtime.

That separation is intentional. The two systems do not have identical contracts, and the umbrella does not pretend that one ledger is a distributed transaction over every other ledger.

The exported `createMaqamCrawlerTool()` is the explicit bridge from Maqam's live HTTP crawler into `ajnas-runtime`. The tool is marked high risk and is never registered automatically:

```js
import { createMaqamCrawlerTool, createProductLoopOS } from "productloop-os";

const os = createProductLoopOS();
const crawler = createMaqamCrawlerTool({
  defaults: { obeyRobots: true, maxPages: 10 }
});

os.tools.register(crawler);
```

The default ProductLoop policy denies tool calls. Registering this adapter does not authorize it: the application must supply an explicit policy and approval path before execution.

## Integration boundary

ProductLoop adapters convert documented records or tool shapes. They are not native integrations with every orchestrator, provider, browser, connector, model SDK, or hosted service.

Cockroach Browser publishes a structural-only ProductLoop capability snapshot.
`adaptCockroachBrowserCapabilitySnapshot()` validates and freezes that metadata
without importing the browser runtime or registering any tool. See the
[Cockroach Browser interop guide](./cockroach-browser-interop.md). Browser
lifecycle and direct-runtime authority remain with the host; exact Maqam
governance exists only when the host routes a consequential action through
Maqam's registered browser adapter.

A direct call outside the selected governed runtime bypasses that runtime's policy, approval, and evidence path. To preserve governance, the host application must route the real side effect through Maqam's gateway or a ProductLoop-registered tool, keep approval binding intact, and enforce network, process, filesystem, identity, credential, and sandbox controls where the effect actually occurs.

Likewise, importing events into a provenance ledger copies evidence; it does not create a distributed transaction. Durable delivery, retries, storage, and reconciliation remain deployment responsibilities.

## Project links

- [Maqam website and documentation](https://maqamagent.com)
- [ProductLoop package atlas](https://maqamagent.com/docs/productloop/)
- [Architecture](./architecture.md)
- [Comparison and positioning](./comparison.md)
- [Contributing](../CONTRIBUTING.md)
- [Governance](../GOVERNANCE.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Support](../SUPPORT.md)
- [Security policy](../SECURITY.md)
- [GitHub Discussions](https://github.com/AjnasNB/productloop-os/discussions)
