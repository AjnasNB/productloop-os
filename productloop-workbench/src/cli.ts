import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { seedWorkbenchDemo } from "./demo.js";
import { inspectWorkbench } from "./doctor.js";
import { startWorkbenchServer } from "./server.js";
import { WorkbenchStore } from "./store.js";
import type { WorkbenchRisk } from "./types.js";

export interface WorkbenchCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

const defaultIo: WorkbenchCliIo = {
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`)
};

export async function runWorkbenchCli(argv: string[], io: WorkbenchCliIo = defaultIo): Promise<number> {
  try {
    const command = argv[0] ?? "help";
    const root = resolve(option(argv, "--root") ?? ".productloop-workbench");
    const databasePath = resolve(root, "workbench.sqlite");
    const json = argv.includes("--json");

    if (command === "help" || command === "--help" || command === "-h") {
      io.stdout(helpText());
      return 0;
    }
    if (command === "init") {
      const existed = existsSync(databasePath);
      const store = new WorkbenchStore(databasePath);
      const integrity = store.verify();
      store.close();
      output(io, json, { ok: true, initialized: !existed, databasePath, integrity }, existed ? `Workbench already initialized at ${databasePath}` : `Initialized Workbench at ${databasePath}`);
      return 0;
    }
    if (command === "doctor") {
      const report = inspectWorkbench(databasePath);
      output(io, json, report, doctorText(report));
      return report.ok ? 0 : 1;
    }

    const store = new WorkbenchStore(databasePath);
    if (command === "demo") {
      const result = await seedWorkbenchDemo(store);
      store.close();
      output(io, json, result, `Loaded the no-key proof. Pending approval: ${result.pendingApprovalId}`);
      return 0;
    }
    if (command === "run") {
      const run = store.createRun({
        title: requiredOption(argv, "--title"),
        purpose: requiredOption(argv, "--purpose"),
        risk: parseRisk(option(argv, "--risk") ?? "medium")
      });
      store.close();
      output(io, json, run, `Created governed run ${run.id}`);
      return 0;
    }
    if (command === "approve" || command === "reject") {
      const id = positional(argv, 1, `${command} requires an approval id.`);
      const approval = store.reviewApproval(id, {
        reviewerId: option(argv, "--reviewer") ?? "local-owner",
        decision: command === "approve" ? "approve" : "reject",
        ...(option(argv, "--comment") === undefined ? {} : { comment: option(argv, "--comment") })
      });
      store.close();
      output(io, json, approval, `${command === "approve" ? "Approved" : "Rejected"} ${approval.id}`);
      return 0;
    }
    if (command === "resume") {
      const id = positional(argv, 1, "resume requires a run id.");
      const run = store.resumeRun(id);
      store.close();
      output(io, json, run, `Consumed the exact approval; ${run.id} is ready for governed dispatch.`);
      return 0;
    }
    if (command === "export") {
      const id = positional(argv, 1, "export requires a run id.");
      const bundle = store.exportRun(id);
      store.close();
      io.stdout(JSON.stringify(bundle, null, 2));
      return 0;
    }
    if (command === "status") {
      const snapshot = store.snapshot();
      store.close();
      output(io, json, snapshot, `${snapshot.runs.length} runs · ${snapshot.approvals.filter((item) => item.status === "pending").length} pending approvals · ${snapshot.integrity.eventCount} verified events`);
      return snapshot.integrity.valid ? 0 : 1;
    }
    if (command === "serve") {
      const port = parsePort(option(argv, "--port") ?? "43120");
      const running = await startWorkbenchServer({ store, port });
      io.stdout(`ProductLoop Workbench is ready at ${running.url}`);
      io.stdout("The dashboard is local-only. Press Ctrl+C to stop it.");
      const stop = async () => {
        await running.close();
        store.close();
      };
      process.once("SIGINT", () => void stop().then(() => { process.exitCode = 0; }));
      process.once("SIGTERM", () => void stop().then(() => { process.exitCode = 0; }));
      return await new Promise<number>(() => undefined);
    }
    store.close();
    io.stderr(`Unknown Workbench command: ${command}`);
    io.stderr(helpText());
    return 2;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function requiredOption(argv: string[], name: string): string {
  const value = option(argv, name);
  if (value === undefined) throw new Error(`${name} is required.`);
  return value;
}

function positional(argv: string[], index: number, message: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(message);
  return value;
}

function parseRisk(value: string): WorkbenchRisk {
  if (value !== "low" && value !== "medium" && value !== "high" && value !== "critical") {
    throw new Error("--risk must be low, medium, high, or critical.");
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) throw new Error("--port must be an integer between 0 and 65535.");
  return port;
}

function output(io: WorkbenchCliIo, json: boolean, value: unknown, text: string): void {
  io.stdout(json ? JSON.stringify(value, null, 2) : text);
}

function doctorText(report: ReturnType<typeof inspectWorkbench>): string {
  const installed = report.optionalAdapters.filter((adapter) => adapter.installed).map((adapter) => adapter.packageName);
  return [
    `Workbench ${report.ok ? "ready" : "needs attention"}`,
    `Node ${report.node.version}: ${report.node.supported ? "supported" : "unsupported"}`,
    `Database: ${report.database.initialized ? report.database.integrity?.valid ? "verified" : "needs attention" : "not initialized (run init)"}`,
    `ProductLoop modules: ${report.productLoop.modules.filter((module) => module.loaded).length}/${report.productLoop.modules.length}`,
    `Optional adapters installed: ${installed.join(", ") || "none"}`,
    "Hosted team control plane: not included"
  ].join("\n");
}

function helpText(): string {
  return `ProductLoop Workbench 0.1.0

Usage:
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

Workbench coordinates durable local records. Real consequential operations must still pass through Maqam or another enforcement boundary.`;
}
