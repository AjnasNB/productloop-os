import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { inspectModules, PRODUCTLOOP_OS_VERSION } from "productloop-os";
import { WorkbenchStore } from "./store.js";

export interface WorkbenchDoctorReport {
  ok: boolean;
  version: string;
  node: { version: string; supported: boolean; requirement: string };
  database: {
    initialized: boolean;
    path: string;
    integrity?: ReturnType<WorkbenchStore["verify"]>;
    error?: string;
  };
  productLoop: {
    version: string;
    modules: ReturnType<typeof inspectModules>;
  };
  optionalAdapters: Array<{ packageName: string; installed: boolean; purpose: string }>;
  hostedControlPlane: { implemented: false; boundary: string };
}

export function inspectWorkbench(databasePath: string): WorkbenchDoctorReport {
  const major = Number(process.versions.node.split(".")[0]);
  const supported = major === 22 || major === 24 || major === 26;
  const modules = inspectModules();
  const require = createRequire(import.meta.url);
  const optionalAdapters = [
    { packageName: "qarinah", purpose: "Evidence-linked local project memory" },
    { packageName: "cockroach-browser", purpose: "Authorized browser sessions and paired evidence" },
    { packageName: "cockroach-crawler", purpose: "Bounded public source records" }
  ].map((entry) => ({ ...entry, installed: canResolve(require, entry.packageName) }));
  const database: WorkbenchDoctorReport["database"] = {
    initialized: existsSync(databasePath),
    path: databasePath
  };
  if (database.initialized) {
    try {
      const store = new WorkbenchStore(databasePath);
      database.integrity = store.verify();
      store.close();
    } catch (error) {
      database.error = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    ok: supported && modules.every((module) => module.loaded) && database.error === undefined && database.integrity?.valid !== false,
    version: "0.1.0",
    node: {
      version: process.versions.node,
      supported,
      requirement: "^22.0.0 || ^24.0.0 || ^26.0.0"
    },
    database,
    productLoop: { version: PRODUCTLOOP_OS_VERSION, modules },
    optionalAdapters,
    hostedControlPlane: {
      implemented: false,
      boundary: "Team synchronization, SSO/RBAC, managed workers, billing, and multi-tenant operations remain separately operated private services."
    }
  };
}

function canResolve(require: NodeJS.Require, packageName: string): boolean {
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}
