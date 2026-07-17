export {
  approvals,
  browserResearch,
  connectors,
  evals,
  inspectModules,
  maqam,
  policy,
  provenance,
  runtime,
  skills
} from "./namespaces.js";
export type { ProductLoopModuleStatus } from "./namespaces.js";

export {
  adaptPolicyEngine,
  adapters,
  browserReportToEvalArtifact,
  createMaqamCrawlerTool,
  runtimeSnapshotToEvalArtifact
} from "./adapters.js";
export type { MaqamCrawlerToolOptions } from "./adapters.js";

export { createDefaultPolicyBundle, createProductLoopOS } from "./composition.js";
export type {
  ProductLoopOS,
  ProductLoopOSOptions,
  SharedBrowserHarnessOptions
} from "./composition.js";

export { runDeterministicDemo } from "./demo.js";
export type { ProductLoopDemoResult } from "./demo.js";

export const PRODUCTLOOP_OS_VERSION = "0.2.1";
