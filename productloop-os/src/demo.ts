import { browserReportToEvalArtifact, runtimeSnapshotToEvalArtifact } from "./adapters.js";
import { createProductLoopOS } from "./composition.js";
import {
  approvals,
  browserResearch,
  evals,
  provenance,
  skills
} from "./namespaces.js";

export interface ProductLoopDemoResult {
  runtimeStatus: string;
  policyDecisions: number;
  skillRecords: number;
  connectorDecision: string;
  approvalStatus: string;
  traceEvents: number;
  traceValid: boolean;
  browserStatus: string;
  browserCitations: number;
  evalStatus: string;
  evalCases: number;
  maqamStatus: string;
  maqamEvidence: number;
}
export async function runDeterministicDemo(): Promise<ProductLoopDemoResult> {
  const timestamp = "2026-07-15T12:00:00.000Z";
  const clock = () => new Date(timestamp);
  const os = createProductLoopOS({
    clock,
    now: () => timestamp,
    traceId: "trace_productloop_demo",
    runIdFactory: () => "run_productloop_demo",
    maqamPolicy: {
      allowedTools: ["local.echo"]
    },
    policyBundle: {
      schemaVersion: "ajnas.policy.bundle.v1",
      id: "productloop.demo-policy",
      version: "1.0.0",
      defaultEffect: "deny",
      rules: [
        {
          id: "allow-local-echo",
          effect: "allow",
          reason: "The deterministic local echo tool is allowed by the demo policy.",
          match: {
            toolNames: ["local.echo"],
            risks: ["low"]
          }
        }
      ]
    }
  });

  const skillManifest: skills.SkillManifest = {
    schemaVersion: "ajnas.skill.v1",
    id: "com.ajnas.productloop.demo",
    name: "ProductLoop deterministic demo",
    version: "1.0.0",
    description: "A local-only fixture used to verify registry and provenance bridges.",
    license: "MIT",
    entrypoint: {
      type: "module",
      value: "./demo.js"
    },
    compatibility: {
      ajnasRuntime: "^0.1.0"
    },
    capabilities: [
      {
        name: "local.echo",
        description: "Echo deterministic local data.",
        risk: "low"
      }
    ],
    permissions: {
      network: "none",
      filesystem: "none",
      externalPublish: false,
      humanApproval: "on_high_risk"
    },
    trust: {
      source: "first-party",
      publisher: "ajnas",
      repository: "https://github.com/AjnasNB/productloop-os",
      licenseEvidence: {
        kind: "repository",
        checkedAt: timestamp,
        url: "https://github.com/AjnasNB/productloop-os/blob/main/LICENSE"
      }
    }
  };
  os.skills.register(skillManifest, {
    actor: "productloop-demo",
    source: "productloop-os:deterministic-demo"
  });

  os.connectors.register({
    schemaVersion: "ajnas.connector.manifest.v1",
    id: "com.ajnas.productloop.local-echo",
    version: "1.0.0",
    name: "Local echo connector",
    description: "A no-network connector fixture for composition tests.",
    kind: "custom",
    publisher: { name: "Ajnas" },
    runtime: { transport: "local", entrypoint: "local.echo" },
    auth: { type: "none" },
    permissions: [
      {
        id: "local-read",
        purpose: "Read public deterministic fixture data.",
        operations: ["read"],
        resources: ["memory:demo"],
        dataClasses: ["public"],
        destinations: ["local"],
        risk: "low"
      }
    ],
    capabilities: [
      {
        id: "local.echo",
        name: "Local echo",
        description: "Return input without external I/O.",
        operations: ["read"],
        dataClasses: ["public"],
        destinations: ["local"],
        risk: "low"
      }
    ],
    trust: {
      license: "MIT",
      reviewStatus: "approved",
      reviewedBy: "productloop-demo",
      reviewedAt: timestamp,
      sandbox: {
        network: "none",
        filesystem: "none",
        secrets: "none"
      }
    }
  }, { actorId: "productloop-demo" });

  const connectorTrust = os.connectors.evaluateTrust("com.ajnas.productloop.local-echo");
  const approvalWorkflow: approvals.ApprovalWorkflow = {
    schemaVersion: "ajnas.approval.workflow.v1",
    id: "productloop.demo-review",
    version: "1.0.0",
    name: "ProductLoop demo review",
    owner: "productloop-demo",
    stages: [
      {
        id: "review",
        name: "Review",
        reviewers: [{ id: "demo-reviewer", kind: "user" }],
        quorum: { strategy: "any" }
      }
    ],
    policy: {
      preventRequesterSelfApproval: true,
      allowedRiskLevels: ["low", "medium", "high", "critical"]
    }
  };
  const approvalSubject = approvals.createApprovalSubjectFromConnectorTrust(connectorTrust, {
    title: "Review local demo connector",
    summary: "Confirm the connector-to-approval adapter is executable."
  });
  const pendingApproval = os.approvals.request({
    workflow: approvalWorkflow,
    subject: approvalSubject,
    requestedBy: "demo-requester",
    reason: "Exercise the approval queue without external side effects."
  });
  const approved = os.approvals.review(pendingApproval.id, approvalWorkflow, {
    reviewerId: "demo-reviewer",
    decision: "approve",
    comment: "Deterministic fixture approved."
  });

  os.tools.register({
    name: "local.echo",
    description: "Return deterministic local input.",
    risk: "low",
    execute: ({ input }) => ({ echoed: input })
  });
  const run = await os.runtime.run({
    name: "productloop-demo",
    input: { message: "hello" },
    steps: [
      {
        id: "echo",
        run: (context) => context.callTool("local.echo", context.input, { purpose: "deterministic demo" })
      }
    ]
  });
  os.importRuntimeEvents();
  os.importSkillAuditEvents();

  const plan: browserResearch.BrowserResearchPlan = {
    schema: "ajnas.browser.research.plan.v1",
    id: "productloop-replay-plan",
    objective: "Verify the deterministic browser-research adapter boundary.",
    policy: {
      allowedOrigins: ["https://example.com"],
      allowedActions: ["note"],
      maxSteps: 1,
      citationRequired: true
    },
    steps: [
      {
        id: "record-note",
        action: "note",
        purpose: "Record a pre-reviewed fixture with a citation."
      }
    ],
    output: {
      requireCitations: true,
      exportProvenance: true,
      format: "json"
    }
  };
  const replay = new browserResearch.ReplayBrowserAdapter([
    {
      stepId: "record-note",
      action: "note",
      output: {
        note: "This is deterministic replay data; no live browser was used.",
        citations: [
          {
            url: "https://example.com/evidence",
            title: "Deterministic example evidence",
            locator: "fixture:1",
            quote: "Reviewed fixture evidence"
          }
        ]
      }
    }
  ]);
  const browserReport = await os.createBrowserHarness(replay, {
    runId: "run_productloop_browser_demo"
  }).run(plan);

  const runtimeArtifact = runtimeSnapshotToEvalArtifact(run, os.trace.events);
  const browserArtifact = browserReportToEvalArtifact(browserReport);
  const suite: evals.EvalSuite = {
    schemaVersion: "ajnas.eval.suite.v1",
    id: "productloop.demo-suite",
    version: "1.0.0",
    cases: [
      {
        id: "runtime",
        assertions: [
          { id: "runtime-completed", kind: "run.status", status: "completed" },
          { id: "runtime-events", kind: "event.type.count", eventType: "run.completed", min: 1 },
          { id: "runtime-provenance", kind: "provenance.valid", valid: true }
        ]
      },
      {
        id: "browser",
        assertions: [
          { id: "browser-passed", kind: "run.status", status: "passed" },
          { id: "browser-note", kind: "browser.step", stepType: "note", status: "passed" },
          { id: "browser-provenance", kind: "provenance.valid", valid: true }
        ]
      }
    ]
  };
  const evalReport = await evals.runEvalSuite(
    suite,
    (testCase) => testCase.id === "runtime" ? runtimeArtifact : browserArtifact,
    { generatedAt: timestamp, generatedBy: "productloop-os" }
  );

  os.maqamGateway.registerTool(
    "local.echo",
    async (input = {}) => {
      os.maqamEvidence.addEvidence({
        evidenceId: "ev_productloop_demo",
        runId: "run_maqam_demo",
        taskId: "echo",
        sourceType: "local-fixture",
        source: "productloop-os:deterministic-demo",
        excerpt: JSON.stringify(input),
        tool: "local.echo",
        confidence: 1
      });
      return { echoed: input };
    },
    { effects: [] }
  );
  const maqamRun = await os.maqamRuntime.runWorkflow(
    {
      tasks: [
        {
          id: "echo",
          run: () => os.maqamGateway.call(
            "local.echo",
            { message: "hello from Maqam" },
            { runId: "run_maqam_demo", goal: { allowedTools: ["local.echo"] } }
          )
        }
      ]
    },
    { runId: "run_maqam_demo", allowedTools: ["local.echo"] }
  );

  const traceVerification = provenance.verifyTrace(os.trace.events);
  return {
    runtimeStatus: run.status,
    policyDecisions: os.policyAudit.events.length,
    skillRecords: os.skills.list().length,
    connectorDecision: connectorTrust.decision,
    approvalStatus: approved.status,
    traceEvents: os.trace.events.length,
    traceValid: traceVerification.valid,
    browserStatus: browserReport.status,
    browserCitations: browserReport.citations.length,
    evalStatus: evalReport.summary.failedCases === 0 ? "passed" : "failed",
    evalCases: evalReport.summary.totalCases,
    maqamStatus: String(maqamRun.status),
    maqamEvidence: os.maqamEvidence.listEvidence().length
  };
}
