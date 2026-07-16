import {
  approvals,
  browserResearch,
  connectors,
  evals,
  maqam,
  policy,
  provenance,
  runtime
} from "./namespaces.js";

export function adaptPolicyEngine(engine: policy.RuntimePolicyEngine): runtime.PolicyEngine {
  return {
    async evaluate(request) {
      return engine.evaluate({
        runId: request.runId,
        stepId: request.stepId,
        tool: {
          name: request.tool.name,
          description: request.tool.description,
          risk: request.tool.risk
        },
        input: request.input,
        metadata: { ...request.metadata }
      });
    }
  };
}

export interface MaqamCrawlerToolOptions {
  name?: string;
  /** Deployment-enforced crawl options. Call input cannot override these values. */
  defaults?: maqam.CrawlOptions;
}

export function createMaqamCrawlerTool(
  options: MaqamCrawlerToolOptions = {}
): runtime.ToolDefinition<maqam.CrawlOptions, maqam.CrawlPage[]> {
  const lockedDefaults = lockCrawlOptions(options.defaults);
  return {
    name: options.name ?? "maqam.crawl",
    description: "Crawl explicitly supplied HTTP(S) seeds with Maqam; this performs live network I/O.",
    risk: "high",
    async execute({ input }) {
      return maqam.crawl({
        ...input,
        ...lockedDefaults
      });
    }
  };
}

function lockCrawlOptions(value: maqam.CrawlOptions | undefined): Readonly<maqam.CrawlOptions> {
  if (!value) return Object.freeze({});
  const copy: maqam.CrawlOptions = { ...value };
  for (const key of ["seeds", "urls", "allowedOrigins"] as const) {
    const entries = value[key];
    if (entries) copy[key] = Object.freeze([...entries]) as string[];
  }
  return Object.freeze(copy);
}

export function runtimeSnapshotToEvalArtifact(
  snapshot: runtime.RunSnapshot,
  traceEvents: provenance.ProvenanceTraceEvent[] = []
): evals.AgentRunArtifact {
  const traceVerification = traceEvents.length > 0
    ? provenance.verifyTrace(traceEvents)
    : undefined;

  return {
    schemaVersion: "ajnas.run.artifact.v1",
    runId: snapshot.runId,
    status: snapshot.status,
    output: evals.toJsonValue(snapshot.outputs),
    events: snapshot.events.map((event) => ({
      sequence: event.sequence,
      type: event.type,
      timestamp: event.timestamp,
      data: event.data,
      receiptHash: event.receipt.eventHash
    })),
    provenance: traceVerification
      ? {
          valid: traceVerification.valid,
          rootHash: traceEvents.at(-1)?.receipt.eventHash,
          eventCount: traceEvents.length,
          issues: traceVerification.issues
        }
      : undefined,
    metadata: evals.toJsonObject({
      workflowName: snapshot.name,
      startedAt: snapshot.startedAt,
      completedAt: snapshot.completedAt ?? null,
      failedAt: snapshot.failedAt ?? null
    })
  };
}

export function browserReportToEvalArtifact(
  report: browserResearch.BrowserResearchReport
): evals.AgentRunArtifact {
  const verification = browserResearch.verifyBrowserResearchReport(report);
  return {
    schemaVersion: "ajnas.run.artifact.v1",
    runId: report.runId,
    status: report.status,
    output: evals.toJsonValue({
      planId: report.planId,
      objective: report.objective,
      summary: report.summary,
      citations: report.citations
    }),
    browserSteps: report.steps.map((step) => ({
      stepId: step.id,
      type: step.action,
      status: step.status === "completed" ? "passed" : step.status,
      evidenceDigest: step.outputDigest ?? step.digest,
      metadata: evals.toJsonObject({
        purpose: step.purpose,
        policyDecision: step.policyDecision.effect,
        origin: step.policyDecision.origin ?? null,
        citations: step.citations.length
      })
    })),
    provenance: {
      valid: verification.valid,
      rootHash: report.audit.at(-1)?.hash,
      eventCount: report.audit.length,
      bundleDigest: report.digest,
      issues: verification.issues.map((issue) => `${issue.path}: ${issue.message}`)
    },
    metadata: evals.toJsonObject({
      planDigest: report.planDigest,
      startedAt: report.startedAt,
      completedAt: report.completedAt
    })
  };
}

export const adapters = Object.freeze({
  policyEngine: adaptPolicyEngine,
  maqamCrawlerTool: createMaqamCrawlerTool,
  runtimeSnapshotToEvalArtifact,
  browserReportToEvalArtifact,
  policyDecisionToApprovalSubject: approvals.createApprovalSubjectFromPolicyDecision,
  connectorTrustToApprovalSubject: approvals.createApprovalSubjectFromConnectorTrust,
  approvalTicketToRuntimeDecision: approvals.createRuntimeDecisionFromApprovalTicket,
  connectorTrustToRuntimeDecision: connectors.connectorTrustDecisionToRuntimeDecision
});
