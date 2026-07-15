import { adaptPolicyEngine } from "./adapters.js";
import {
  approvals,
  browserResearch,
  connectors,
  maqam,
  policy,
  provenance,
  runtime,
  skills
} from "./namespaces.js";

type MaqamPolicyOptions = NonNullable<ConstructorParameters<typeof maqam.PolicyEngine>[0]>;

export interface ProductLoopOSOptions {
  clock?: () => Date;
  now?: () => string;
  traceId?: string;
  redactionKeys?: string[];
  tools?: runtime.ToolDefinition[];
  policyBundle?: policy.PolicyBundle;
  runtimePolicy?: runtime.PolicyEngine;
  approver?: runtime.Approver;
  store?: runtime.RunStore;
  runIdFactory?: () => string;
  maqamPolicy?: MaqamPolicyOptions;
}

export type SharedBrowserHarnessOptions = Omit<
  browserResearch.BrowserResearchHarnessOptions,
  "adapter" | "auditLedger"
> & {
  auditLedger?: browserResearch.BrowserResearchAuditLedgerLike;
};

export interface ProductLoopOS {
  tools: runtime.ToolRegistry;
  runtime: runtime.AgentRuntime;
  runtimeEvidence: runtime.InMemoryProvenanceSink;
  trace: provenance.TraceLedger;
  policyBundle: policy.PolicyBundle;
  policy: policy.DeclarativePolicyEngine;
  policyAudit: policy.PolicyDecisionLedger;
  approvals: approvals.ApprovalQueue;
  approvalAudit: approvals.ApprovalAuditLedger;
  skills: skills.SkillRegistry;
  skillAudit: skills.SkillAuditLedger;
  connectors: connectors.ConnectorRegistry;
  connectorAudit: ReturnType<typeof connectors.ConnectorRegistry.withAudit>["audit"];
  browserAudit: browserResearch.BrowserResearchAuditLedger;
  maqamPolicy: maqam.PolicyEngine;
  maqamEvidence: maqam.EvidenceLedger;
  maqamApprovals: maqam.ApprovalQueue;
  maqamGateway: maqam.ToolGateway;
  maqamRuntime: maqam.AgentRuntime;
  importRuntimeEvents(events?: runtime.RuntimeEvent[]): provenance.ProvenanceTraceEvent[];
  importSkillAuditEvents(events?: skills.SkillAuditEvent[]): provenance.ProvenanceTraceEvent[];
  createBrowserHarness(
    adapter: browserResearch.BrowserResearchAdapter,
    options?: SharedBrowserHarnessOptions
  ): browserResearch.BrowserResearchHarness;
}

export function createDefaultPolicyBundle(): policy.PolicyBundle {
  return {
    schemaVersion: "ajnas.policy.bundle.v1",
    id: "productloop-os.default-deny",
    version: "1.0.0",
    description: "Deny tool calls until an application supplies explicit allow or approval rules.",
    owner: "productloop-os",
    defaultEffect: "deny",
    rules: []
  };
}

export function createProductLoopOS(options: ProductLoopOSOptions = {}): ProductLoopOS {
  const clock = options.clock ?? (() => new Date());
  const now = options.now ?? (() => clock().toISOString());
  const tools = runtime.ToolRegistry.from(options.tools ?? []);
  const runtimeEvidence = new runtime.InMemoryProvenanceSink({ clock });
  const trace = new provenance.TraceLedger({
    traceId: options.traceId,
    clock,
    redactionKeys: options.redactionKeys
  });

  const policyBundle = options.policyBundle ?? createDefaultPolicyBundle();
  const policyAudit = new policy.PolicyDecisionLedger({ clock });
  const policyEngine = new policy.DeclarativePolicyEngine({
    bundle: policyBundle,
    audit: policyAudit
  });

  const approvalAudit = new approvals.ApprovalAuditLedger({ clock });
  const approvalQueue = new approvals.ApprovalQueue({ clock, audit: approvalAudit });
  const skillAudit = new skills.SkillAuditLedger({ clock });
  const skillRegistry = new skills.SkillRegistry({ audit: skillAudit, clock });
  const connectorSetup = connectors.ConnectorRegistry.withAudit(clock);
  const browserAudit = new browserResearch.BrowserResearchAuditLedger({ now });

  const agentRuntime = new runtime.AgentRuntime({
    tools,
    policy: options.runtimePolicy ?? adaptPolicyEngine(policyEngine),
    approver: options.approver,
    provenance: runtimeEvidence,
    store: options.store,
    clock,
    runIdFactory: options.runIdFactory
  });

  const maqamPolicy = new maqam.PolicyEngine(options.maqamPolicy);
  const maqamEvidence = new maqam.EvidenceLedger({ clock });
  const maqamApprovals = new maqam.ApprovalQueue({ clock });
  const maqamGateway = new maqam.ToolGateway({
    policyEngine: maqamPolicy,
    evidenceLedger: maqamEvidence,
    approvalQueue: maqamApprovals,
    clock
  });
  const maqamRuntime = new maqam.AgentRuntime({
    policyEngine: maqamPolicy,
    evidenceLedger: maqamEvidence,
    toolGateway: maqamGateway,
    approvalQueue: maqamApprovals,
    clock
  });

  const importedRuntimeReceipts = new Set<string>();
  const importedSkillReceipts = new Set<string>();

  const result: ProductLoopOS = {
    tools,
    runtime: agentRuntime,
    runtimeEvidence,
    trace,
    policyBundle,
    policy: policyEngine,
    policyAudit,
    approvals: approvalQueue,
    approvalAudit,
    skills: skillRegistry,
    skillAudit,
    connectors: connectorSetup.registry,
    connectorAudit: connectorSetup.audit,
    browserAudit,
    maqamPolicy,
    maqamEvidence,
    maqamApprovals,
    maqamGateway,
    maqamRuntime,
    importRuntimeEvents(events = runtimeEvidence.events) {
      const imported: provenance.ProvenanceTraceEvent[] = [];
      for (const event of events) {
        if (importedRuntimeReceipts.has(event.receipt.eventHash)) {
          continue;
        }
        imported.push(provenance.importRuntimeEvent(trace, event));
        importedRuntimeReceipts.add(event.receipt.eventHash);
      }
      return imported;
    },
    importSkillAuditEvents(events = skillAudit.events) {
      const imported: provenance.ProvenanceTraceEvent[] = [];
      for (const event of events) {
        if (importedSkillReceipts.has(event.receipt.eventHash)) {
          continue;
        }
        imported.push(provenance.importSkillAuditEvent(trace, event));
        importedSkillReceipts.add(event.receipt.eventHash);
      }
      return imported;
    },
    createBrowserHarness(adapter, harnessOptions = {}) {
      return new browserResearch.BrowserResearchHarness({
        ...harnessOptions,
        adapter,
        auditLedger: harnessOptions.auditLedger ?? browserAudit,
        now: harnessOptions.now ?? now
      });
    }
  };

  return result;
}
