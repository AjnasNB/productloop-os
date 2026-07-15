import {
  type ApprovalGateResolution,
  type BrowserAdapterOutput,
  type BrowserResearchAdapterInput,
  type BrowserResearchHarnessOptions,
  type BrowserResearchPlan,
  type BrowserResearchReport,
  type BrowserResearchStatus,
  type BrowserResearchStep,
  type BrowserStepLog,
  type BrowserStepStatus,
  type CrawlAdapterOutput,
  type ExtractAdapterOutput,
  type NoteAdapterOutput,
  type OpenAdapterOutput,
  type ResearchCitation,
  type ResearchCitationInput,
  type SearchAdapterOutput,
  type VerificationResult
} from "./types.js";
import { BrowserResearchAuditLedger, verifyBrowserResearchAuditTrail } from "./audit.js";
import { createApprovalGateRequest, evaluateBrowserResearchPolicy } from "./policy.js";
import { assertBrowserResearchPlan, computeBrowserResearchPlanDigest } from "./validation.js";
import { sha256Digest, sha256Hex, sha256TextDigest, toJsonObject, toJsonValue } from "./stable-json.js";

function summarizeOutput(output: BrowserAdapterOutput, retainFullText: boolean): Record<string, unknown> {
  if ("results" in output) {
    return {
      kind: "search",
      resultCount: output.results.length,
      urls: output.results.map((result) => result.url)
    };
  }
  if ("pages" in output) {
    return {
      kind: "crawl",
      pageCount: output.pages.length,
      urls: output.pages.map((page) => page.url)
    };
  }
  if ("claims" in output) {
    return {
      kind: "extract",
      url: output.url,
      title: output.title,
      claimCount: output.claims.length,
      claims: output.claims.map((claim) => claim.text)
    };
  }
  if ("note" in output) {
    return {
      kind: "note",
      note: output.note
    };
  }
  return {
    kind: "open",
    url: output.url,
    title: output.title,
    textLength: output.text?.length ?? 0,
    ...(retainFullText && output.text !== undefined ? { text: output.text } : {})
  };
}

function citationFromInput(step: BrowserResearchStep, input: ResearchCitationInput, now: string): ResearchCitation {
  const quote = input.quote;
  const evidence = {
    stepId: step.id,
    url: input.url,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.locator === undefined ? {} : { locator: input.locator }),
    ...(quote === undefined ? {} : { quote })
  };
  const evidenceDigest = sha256Digest(evidence);
  return {
    id: `cit_${sha256Hex(evidence).slice(0, 20)}`,
    stepId: step.id,
    url: input.url,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.locator === undefined ? {} : { locator: input.locator }),
    ...(quote === undefined ? {} : { quote }),
    excerptHash: quote ? sha256TextDigest(quote) : sha256Digest({ empty: true }),
    evidenceDigest,
    capturedAt: input.capturedAt ?? now,
    ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
  };
}

function normalizeCitations(step: BrowserResearchStep, output: BrowserAdapterOutput, now: string): ResearchCitation[] {
  const citations: ResearchCitationInput[] = [];

  if ("results" in output) {
    output.results.forEach((result) => {
      citations.push({
        url: result.url,
        ...(result.title === undefined ? {} : { title: result.title }),
        ...(result.rank === undefined ? {} : { locator: `rank:${result.rank}` }),
        ...(result.snippet === undefined ? {} : { quote: result.snippet })
      });
    });
  }

  if ("pages" in output) {
    output.pages.forEach((page) => {
      const quote = page.snippet ?? page.text?.slice(0, 240);
      citations.push({
        url: page.url,
        ...(page.title === undefined ? {} : { title: page.title }),
        ...(page.depth === undefined ? {} : { locator: `depth:${page.depth}` }),
        ...(quote === undefined ? {} : { quote })
      });
    });
  }

  if ("citations" in output && Array.isArray(output.citations)) {
    citations.push(...output.citations);
  }

  if ("claims" in output) {
    output.claims.forEach((claim, index) => {
      if (claim.citation) {
        citations.push({
          ...claim.citation,
          locator: claim.citation.locator ?? `claim:${index + 1}`
        });
      }
    });
  }

  if ("url" in output && citations.length === 0) {
    citations.push({
      url: output.url,
      ...(output.title === undefined ? {} : { title: output.title }),
      quote: "adapter returned source URL without extractable text"
    });
  }

  const seen = new Set<string>();
  return citations
    .map((citation) => citationFromInput(step, citation, now))
    .filter((citation) => {
      if (seen.has(citation.evidenceDigest)) {
        return false;
      }
      seen.add(citation.evidenceDigest);
      return true;
    });
}

function computeStepDigest(step: Omit<BrowserStepLog, "digest">): string {
  return sha256Digest(step);
}

export function computeBrowserResearchReportDigest(report: Omit<BrowserResearchReport, "digest"> | BrowserResearchReport): string {
  const { digest: _digest, ...withoutDigest } = report as BrowserResearchReport;
  return sha256Digest(withoutDigest);
}

async function executeAdapterStep(input: BrowserResearchAdapterInput, options: BrowserResearchHarnessOptions): Promise<BrowserAdapterOutput> {
  const adapter = options.adapter;
  switch (input.step.action) {
    case "search":
      if (!adapter.search) {
        throw new Error("Adapter does not implement search");
      }
      return adapter.search(input) as Promise<SearchAdapterOutput> | SearchAdapterOutput;
    case "open":
      if (!adapter.open) {
        throw new Error("Adapter does not implement open");
      }
      return adapter.open(input) as Promise<OpenAdapterOutput> | OpenAdapterOutput;
    case "extract":
      if (!adapter.extract) {
        throw new Error("Adapter does not implement extract");
      }
      return adapter.extract(input) as Promise<ExtractAdapterOutput> | ExtractAdapterOutput;
    case "crawl":
      if (!adapter.crawl) {
        throw new Error("Adapter does not implement crawl");
      }
      return adapter.crawl(input) as Promise<CrawlAdapterOutput> | CrawlAdapterOutput;
    case "note":
      if (!adapter.note) {
        throw new Error("Adapter does not implement note");
      }
      return adapter.note(input) as Promise<NoteAdapterOutput> | NoteAdapterOutput;
  }
}

export class BrowserResearchHarness {
  private readonly options: BrowserResearchHarnessOptions;

  constructor(options: BrowserResearchHarnessOptions) {
    this.options = options;
  }

  async run(planInput: unknown): Promise<BrowserResearchReport> {
    const plan = assertBrowserResearchPlan(planInput);
    const now = this.options.now ?? (() => new Date().toISOString());
    const auditLedger = this.options.auditLedger ?? new BrowserResearchAuditLedger({ now });
    const planDigest = computeBrowserResearchPlanDigest(plan);
    const startedAt = now();
    const runId = this.options.runId ?? `run_${sha256Hex({ planDigest, startedAt }).slice(0, 20)}`;
    const steps: BrowserStepLog[] = [];
    const citations: ResearchCitation[] = [];
    let status: BrowserResearchStatus = "passed";

    auditLedger.record({
      type: "run_started",
      runId,
      at: startedAt,
      payload: toJsonObject({ planId: plan.id, planDigest, objective: plan.objective })
    });

    for (const [index, step] of plan.steps.entries()) {
      const stepStartedAt = now();
      const inputDigest = sha256Digest({
        runId,
        planId: plan.id,
        step
      });
      const decision = evaluateBrowserResearchPolicy(plan, step, { stepIndex: index });
      auditLedger.record({
        type: "policy_decision",
        runId,
        stepId: step.id,
        at: stepStartedAt,
        payload: toJsonObject({ decision })
      });

      let stepStatus: BrowserStepStatus = "completed";
      let outputDigest: string | undefined;
      let outputSummary: Record<string, unknown> | undefined;
      let approvalResolution: ApprovalGateResolution | undefined;
      let error: string | undefined;
      let stepCitations: ResearchCitation[] = [];
      const approvalRequest =
        decision.effect === "require_approval"
          ? createApprovalGateRequest({
              runId,
              plan,
              step,
              decision,
              inputDigest,
              createdAt: stepStartedAt
            })
          : undefined;

      if (decision.effect === "deny") {
        stepStatus = "denied";
        status = "denied";
        error = decision.reasons.join("; ");
      } else if (approvalRequest) {
        auditLedger.record({
          type: "approval_requested",
          runId,
          stepId: step.id,
          at: stepStartedAt,
          payload: toJsonObject({ approvalRequest })
        });
        approvalResolution = await this.options.approvalProvider?.(approvalRequest);
        if (!approvalResolution || approvalResolution.status !== "approved") {
          stepStatus = "awaiting_approval";
          status = "awaiting_approval";
          error = approvalResolution?.reason ?? "approval required before step execution";
        } else {
          auditLedger.record({
            type: "approval_resolved",
            runId,
            stepId: step.id,
            at: approvalResolution.decidedAt,
            payload: toJsonObject({ approvalResolution })
          });
        }
      }

      if (stepStatus === "completed") {
        try {
          const output = await executeAdapterStep(
            {
              runId,
              plan,
              step,
              inputDigest
            },
            this.options
          );
          outputDigest = sha256Digest(output);
          stepCitations = normalizeCitations(step, output, now());
          outputSummary = summarizeOutput(output, plan.policy?.retainFullText === true);
          if ((plan.policy?.citationRequired || plan.output?.requireCitations) && stepCitations.length === 0) {
            stepStatus = "failed";
            status = "failed";
            error = "step completed without required citations";
          }
        } catch (caught) {
          stepStatus = "failed";
          status = "failed";
          error = caught instanceof Error ? caught.message : String(caught);
        }
      }

      const stepEndedAt = now();
      const stepWithoutDigest: Omit<BrowserStepLog, "digest"> = {
        schema: "ajnas.browser.research.step-log.v1",
        index,
        id: step.id,
        action: step.action,
        status: stepStatus,
        purpose: step.purpose,
        startedAt: stepStartedAt,
        endedAt: stepEndedAt,
        inputDigest,
        ...(outputDigest === undefined ? {} : { outputDigest }),
        ...(outputSummary === undefined ? {} : { outputSummary: toJsonObject(outputSummary) }),
        policyDecision: decision,
        citations: stepCitations,
        ...(approvalRequest === undefined ? {} : { approvalRequest }),
        ...(approvalResolution === undefined ? {} : { approvalResolution }),
        ...(error === undefined ? {} : { error })
      };
      const stepLog: BrowserStepLog = {
        ...stepWithoutDigest,
        digest: computeStepDigest(stepWithoutDigest)
      };
      steps.push(stepLog);
      citations.push(...stepCitations.map((citation) => toJsonValue(citation) as unknown as ResearchCitation));

      auditLedger.record({
        type: "step_completed",
        runId,
        stepId: step.id,
        at: stepEndedAt,
        payload: toJsonObject({
          stepDigest: stepLog.digest,
          status: stepStatus,
          citationCount: stepCitations.length,
          ...(outputDigest === undefined ? {} : { outputDigest })
        })
      });

      if (stepStatus !== "completed") {
        break;
      }
    }

    const completedAt = now();
    const summary = {
      stepsPlanned: plan.steps.length,
      stepsRun: steps.length,
      citationsCaptured: citations.length,
      deniedSteps: steps.filter((step) => step.status === "denied").length,
      approvalRequests: steps.filter((step) => step.approvalRequest).length,
      failedSteps: steps.filter((step) => step.status === "failed").length
    };

    auditLedger.record({
      type: "run_completed",
      runId,
      at: completedAt,
      payload: toJsonObject({ status, summary })
    });

    const withoutDigest: Omit<BrowserResearchReport, "digest"> = {
      schema: "ajnas.browser.research.report.v1",
      runId,
      planId: plan.id,
      planDigest,
      objective: plan.objective,
      status,
      startedAt,
      completedAt,
      steps,
      citations,
      summary,
      audit: auditLedger.receipts
    };

    return {
      ...withoutDigest,
      digest: computeBrowserResearchReportDigest(withoutDigest)
    };
  }
}

export function runBrowserResearchPlan(plan: unknown, options: BrowserResearchHarnessOptions): Promise<BrowserResearchReport> {
  return new BrowserResearchHarness(options).run(plan);
}

export function verifyBrowserResearchReport(report: BrowserResearchReport): VerificationResult {
  const issues = [];
  const expectedDigest = computeBrowserResearchReportDigest(report);
  if (report.digest !== expectedDigest) {
    issues.push({
      path: "$.digest",
      message: "Report digest does not match deterministic report contents",
      severity: "error" as const
    });
  }

  report.steps.forEach((step, index) => {
    const { digest, ...withoutDigest } = step;
    const expectedStepDigest = computeStepDigest(withoutDigest);
    if (digest !== expectedStepDigest) {
      issues.push({
        path: `$.steps[${index}].digest`,
        message: "Step digest does not match deterministic step log contents",
        severity: "error" as const
      });
    }
  });

  const auditResult = verifyBrowserResearchAuditTrail(report.audit);
  issues.push(...auditResult.issues);

  return {
    valid: issues.length === 0,
    issues
  };
}
