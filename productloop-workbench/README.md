# ProductLoop Workbench

ProductLoop Workbench is the local, open-source control center for the ProductLoop governed-agent stack.

It gives one operator a durable place to inspect runs, review exact action proposals, connect evidence and memory references, explain policy outcomes, and export a proof bundle. Workbench coordinates records; it does not replace Maqam's real execution boundary, Cockroach Browser's session authority, Cockroach Crawler's source limits, or Qarinah's workspace consent.

## Start from this repository

```bash
npm install
npm run build --workspace=productloop-workbench
node productloop-workbench/bin/productloop-workbench.js init
node productloop-workbench/bin/productloop-workbench.js demo
node productloop-workbench/bin/productloop-workbench.js serve
```

Open `http://127.0.0.1:43120` in the same operator account. The demonstration needs no model key, provider account, browser profile, or live network request.

After the reviewed `0.1.0` artifact, provenance, tag, and registry record match, the equivalent public commands will be `npm install productloop-workbench` and `npx productloop-workbench`.

## Five operator surfaces

- **Runs** — durable local status, purpose, risk, policy reason, and current step.
- **Approvals** — exact canonical input, effect, risk, digest, decision, reviewer, and one-use consumption.
- **Evidence** — source-oriented records from ProductLoop, Maqam, Cockroach Browser, Cockroach Crawler, or a custom adapter.
- **Memory** — cited Qarinah or custom event references; never silent context capture.
- **Policies** — concise allow, deny, and approval explanations plus the private hosted boundary.

## Commands

```text
productloop-workbench init [--root DIRECTORY]
productloop-workbench doctor [--json] [--root DIRECTORY]
productloop-workbench demo [--json] [--root DIRECTORY]
productloop-workbench run --title TEXT --purpose TEXT [--risk LEVEL]
productloop-workbench approve APPROVAL_ID [--reviewer ID] [--comment TEXT]
productloop-workbench reject APPROVAL_ID [--reviewer ID] [--comment TEXT]
productloop-workbench resume RUN_ID
productloop-workbench export RUN_ID
productloop-workbench status [--json]
productloop-workbench serve [--port 43120]
```

The default data root is `.productloop-workbench` under the current directory. The SQLite database uses WAL journaling, full synchronous commits, foreign keys, transactional mutations, and a per-run hash-linked event ledger so each exported run contains a self-verifiable chain.

## Exact approval lifecycle

1. A host creates a durable run.
2. Policy identifies a consequential operation.
3. Workbench stores the exact tool, effect, risk, input, and input digest.
4. A reviewer approves or rejects that specific record.
5. Resume atomically changes the approval from `approved` to `consumed` once.
6. A trusted host may dispatch the corresponding operation through Maqam after independently verifying the binding.
7. Evidence and memory outcome references can be attached afterward.

Workbench never treats a dashboard click as proof that an external tool executed. The external receipt must come from the governed runtime.

## JavaScript API

```js
import { WorkbenchStore } from "productloop-workbench";

const store = new WorkbenchStore(".productloop-workbench/workbench.sqlite");
const run = store.createRun({
  title: "Prepare release",
  purpose: "Build reviewed artifacts without publishing them",
  risk: "medium"
});

console.log(run.id, store.verify());
store.close();
```

## Public and private boundary

The community package includes:

- durable local runs;
- exact approval records and one-use consumption;
- evidence and Qarinah memory links;
- policy inspection;
- local dashboard and CLI;
- proof-bundle export;
- deterministic stack demo; and
- an adapter contract for a separately operated team service.

It does **not** include:

- hosted team synchronization;
- SSO, organizations, or RBAC;
- managed remote browser workers;
- centralized reviewer directories;
- multi-tenant retention or backups;
- a hosted secrets broker;
- billing, customer data, or entitlement enforcement; or
- a hosted control-plane implementation.

Those capabilities require independent tenant isolation, identity, authorization, secret handling, audit retention, incident response, billing, and data-processing review. The exported `TeamControlPlaneAdapter` is an integration boundary, not a claim that those capabilities ship.

## Optional product adapters

`doctor` reports whether Qarinah, Cockroach Browser, and Cockroach Crawler are installed. They remain optional so Workbench can run as a no-key local proof and so each product preserves its own license and authority boundary.

## Security

The dashboard binds only to `127.0.0.1`, validates the exact active loopback `Host`, requires a per-process API token, rejects cross-origin or non-JSON mutation requests, caps request bodies at 64 KiB, and emits restrictive browser security headers. A loopback service is not an operating-system sandbox. Protect the database and do not place credentials in run input or evidence excerpts.

See [SECURITY.md](./SECURITY.md) for the complete boundary.
