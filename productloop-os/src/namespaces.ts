import * as maqam from "maqam";
import * as runtime from "ajnas-runtime";
import * as skills from "ajnas-skills-registry";
import * as provenance from "ajnas-provenance";
import * as policy from "ajnas-policy";
import * as evals from "ajnas-evals";
import * as connectors from "ajnas-connectors";
import * as approvals from "ajnas-approvals";
import * as browserResearch from "ajnas-browser-research";

export {
  maqam,
  runtime,
  skills,
  provenance,
  policy,
  evals,
  connectors,
  approvals,
  browserResearch
};

export interface ProductLoopModuleStatus {
  packageName: string;
  namespace: string;
  loaded: boolean;
  anchor: string;
}
export function inspectModules(): ProductLoopModuleStatus[] {
  return [
    { packageName: "maqam", namespace: "maqam", loaded: typeof maqam.AgentRuntime === "function", anchor: "AgentRuntime" },
    { packageName: "ajnas-runtime", namespace: "runtime", loaded: typeof runtime.AgentRuntime === "function", anchor: "AgentRuntime" },
    { packageName: "ajnas-skills-registry", namespace: "skills", loaded: typeof skills.SkillRegistry === "function", anchor: "SkillRegistry" },
    { packageName: "ajnas-provenance", namespace: "provenance", loaded: typeof provenance.TraceLedger === "function", anchor: "TraceLedger" },
    { packageName: "ajnas-policy", namespace: "policy", loaded: typeof policy.DeclarativePolicyEngine === "function", anchor: "DeclarativePolicyEngine" },
    { packageName: "ajnas-evals", namespace: "evals", loaded: typeof evals.runEvalSuite === "function", anchor: "runEvalSuite" },
    { packageName: "ajnas-connectors", namespace: "connectors", loaded: typeof connectors.ConnectorRegistry === "function", anchor: "ConnectorRegistry" },
    { packageName: "ajnas-approvals", namespace: "approvals", loaded: typeof approvals.ApprovalQueue === "function", anchor: "ApprovalQueue" },
    { packageName: "ajnas-browser-research", namespace: "browserResearch", loaded: typeof browserResearch.BrowserResearchHarness === "function", anchor: "BrowserResearchHarness" }
  ];
}
