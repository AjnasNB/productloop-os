import { evaluateAssertions } from "./assertions.js";
import { sha256Digest, toJsonObject } from "./stable-json.js";
import { computeEvalSuiteDigest, validateEvalSuite } from "./validation.js";
import type {
  AgentRunArtifact,
  EvalCaseExecutor,
  EvalCaseResult,
  EvalReport,
  EvalReportSummary,
  EvalSuite,
  RunEvalSuiteOptions,
  VerificationResult
} from "./types.js";

type EvalReportWithoutDigest = Omit<EvalReport, "digest">;

export async function runEvalSuite(
  suite: EvalSuite,
  executor: EvalCaseExecutor,
  options: RunEvalSuiteOptions = {}
): Promise<EvalReport> {
  const validation = validateEvalSuite(suite);
  if (!validation.valid) {
    const details = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid eval suite: ${details}`);
  }

  const caseResults: EvalCaseResult[] = [];
  for (const [caseIndex, testCase] of suite.cases.entries()) {
    let artifact: AgentRunArtifact;
    let error: string | undefined;

    try {
      artifact = await executor(testCase, { suite, caseIndex });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      artifact = {
        schemaVersion: "ajnas.run.artifact.v1",
        runId: `${suite.id}:${testCase.id}:executor-error`,
        status: "failed",
        output: { error }
      };
    }

    const assertions = evaluateAssertions(testCase.assertions, artifact);
    const failed = assertions.some((assertion) => assertion.status === "failed") || Boolean(error);
    caseResults.push({
      caseId: testCase.id,
      ...(testCase.name === undefined ? {} : { name: testCase.name }),
      status: failed ? "failed" : "passed",
      artifactDigest: sha256Digest(artifact),
      assertions,
      ...(error ? { error } : {})
    });
  }

  const reportWithoutDigest: EvalReportWithoutDigest = {
    schemaVersion: "ajnas.eval.report.v1",
    suiteId: suite.id,
    suiteVersion: suite.version,
    suiteDigest: computeEvalSuiteDigest(suite),
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    generatedBy: options.generatedBy ?? "ajnas-evals",
    summary: summarizeCaseResults(caseResults),
    caseResults,
    ...(options.metadata ? { metadata: options.metadata } : {})
  };

  return {
    ...reportWithoutDigest,
    digest: computeEvalReportDigest(reportWithoutDigest)
  };
}

export function computeEvalReportDigest(report: EvalReport | EvalReportWithoutDigest): string {
  const { digest: _digest, ...withoutDigest } = report as EvalReport;
  return sha256Digest(withoutDigest);
}

export function verifyEvalReport(report: EvalReport): VerificationResult {
  const issues: string[] = [];

  if (report.schemaVersion !== "ajnas.eval.report.v1") {
    issues.push(`unsupported report schema ${String(report.schemaVersion)}`);
  }

  const expectedDigest = computeEvalReportDigest(report);
  if (report.digest !== expectedDigest) {
    issues.push("report digest mismatch");
  }

  const expectedSummary = summarizeCaseResults(report.caseResults);
  if (JSON.stringify(report.summary) !== JSON.stringify(expectedSummary)) {
    issues.push("report summary does not match case results");
  }

  for (const [index, caseResult] of report.caseResults.entries()) {
    const hasFailedAssertion = caseResult.assertions.some((assertion) => assertion.status === "failed");
    const expectedStatus = hasFailedAssertion || caseResult.error ? "failed" : "passed";
    if (caseResult.status !== expectedStatus) {
      issues.push(`case result ${index + 1} has status ${caseResult.status} but expected ${expectedStatus}`);
    }
    if (!caseResult.artifactDigest.startsWith("sha256:")) {
      issues.push(`case result ${index + 1} artifact digest is missing sha256 prefix`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function summarizeCaseResults(caseResults: EvalCaseResult[]): EvalReportSummary {
  const totalAssertions = caseResults.reduce((sum, result) => sum + result.assertions.length, 0);
  const passedAssertions = caseResults.reduce(
    (sum, result) => sum + result.assertions.filter((assertion) => assertion.status === "passed").length,
    0
  );

  return {
    totalCases: caseResults.length,
    passedCases: caseResults.filter((result) => result.status === "passed").length,
    failedCases: caseResults.filter((result) => result.status === "failed").length,
    totalAssertions,
    passedAssertions,
    failedAssertions: totalAssertions - passedAssertions
  };
}

function normalizeGeneratedAt(value: RunEvalSuiteOptions["generatedAt"]): string {
  if (typeof value === "function") {
    return value().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

export function artifactMapFromJson(value: unknown): Record<string, AgentRunArtifact> {
  const object = toJsonObject(value);
  const artifacts = "artifacts" in object && object.artifacts !== null && typeof object.artifacts === "object" && !Array.isArray(object.artifacts)
    ? object.artifacts
    : object;
  return artifacts as unknown as Record<string, AgentRunArtifact>;
}
