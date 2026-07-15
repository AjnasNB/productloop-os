export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type ToolRisk = "low" | "medium" | "high" | "critical";
export type EvalCaseStatus = "passed" | "failed";
export type EvalAssertionStatus = "passed" | "failed";

export type EvalAssertionKind =
  | "run.status"
  | "json.path"
  | "event.type.count"
  | "policy.decision"
  | "approval.status"
  | "provenance.valid"
  | "connector.trust"
  | "browser.step";

export interface EvalSuite {
  schemaVersion: "ajnas.eval.suite.v1";
  id: string;
  version: string;
  title?: string;
  description?: string;
  owner?: string;
  cases: EvalCase[];
  metadata?: JsonObject;
}

export interface EvalCase {
  id: string;
  name?: string;
  description?: string;
  risk?: ToolRisk | string;
  tags?: string[];
  input?: JsonValue;
  assertions: EvalAssertion[];
  metadata?: JsonObject;
}

export interface EvalAssertion {
  id: string;
  kind: EvalAssertionKind;
  description?: string;
  path?: string;
  equals?: JsonValue;
  includes?: JsonValue;
  status?: string;
  eventType?: string;
  min?: number;
  max?: number;
  decision?: string;
  toolName?: string;
  valid?: boolean;
  connectorId?: string;
  trustTier?: string;
  stepType?: string;
  urlHost?: string;
}

export interface RuntimeEvidenceEvent {
  sequence?: number;
  type: string;
  timestamp?: string;
  data?: JsonObject;
  receiptHash?: string;
}

export interface ToolCallEvidence {
  toolName: string;
  status: string;
  inputDigest?: string;
  outputDigest?: string;
  metadata?: JsonObject;
}

export interface PolicyDecisionEvidence {
  toolName: string;
  decision: "allow" | "deny" | "require_approval" | string;
  reason?: string;
  ruleId?: string;
  receiptHash?: string;
  metadata?: JsonObject;
}

export interface ApprovalEvidence {
  toolName: string;
  status: "pending" | "approved" | "rejected" | string;
  requestedBy?: string;
  approverId?: string;
  reason?: string;
  metadata?: JsonObject;
}

export interface ProvenanceEvidence {
  valid: boolean;
  rootHash?: string;
  eventCount?: number;
  bundleDigest?: string;
  signatureValid?: boolean;
  issues?: string[];
}

export interface ConnectorCallEvidence {
  connectorId: string;
  operation: string;
  trustTier: "untrusted" | "declared" | "verified" | string;
  destination?: string;
  dataClasses?: string[];
  metadata?: JsonObject;
}

export interface BrowserStepEvidence {
  stepId: string;
  type: string;
  status: "passed" | "failed" | string;
  url?: string;
  selector?: string;
  evidenceDigest?: string;
  metadata?: JsonObject;
}

export interface AgentRunArtifact {
  schemaVersion?: "ajnas.run.artifact.v1";
  runId: string;
  status: string;
  output?: JsonValue;
  events?: RuntimeEvidenceEvent[];
  toolCalls?: ToolCallEvidence[];
  policyDecisions?: PolicyDecisionEvidence[];
  approvals?: ApprovalEvidence[];
  provenance?: ProvenanceEvidence;
  connectorCalls?: ConnectorCallEvidence[];
  browserSteps?: BrowserStepEvidence[];
  metadata?: JsonObject;
}

export interface EvalAssertionResult {
  assertionId: string;
  kind: EvalAssertionKind;
  status: EvalAssertionStatus;
  message: string;
  expected?: JsonValue;
  actual?: JsonValue;
}

export interface EvalCaseResult {
  caseId: string;
  name?: string;
  status: EvalCaseStatus;
  artifactDigest: string;
  assertions: EvalAssertionResult[];
  error?: string;
}

export interface EvalReportSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
}

export interface EvalReport {
  schemaVersion: "ajnas.eval.report.v1";
  suiteId: string;
  suiteVersion: string;
  suiteDigest: string;
  generatedAt: string;
  generatedBy: string;
  summary: EvalReportSummary;
  caseResults: EvalCaseResult[];
  metadata?: JsonObject;
  digest: string;
}

export interface RunEvalSuiteOptions {
  generatedAt?: string | Date | (() => Date);
  generatedBy?: string;
  metadata?: JsonObject;
}

export interface EvalExecutionContext {
  suite: EvalSuite;
  caseIndex: number;
}

export type EvalCaseExecutor = (
  testCase: EvalCase,
  context: EvalExecutionContext
) => AgentRunArtifact | Promise<AgentRunArtifact>;

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface VerificationResult {
  valid: boolean;
  issues: string[];
}

export interface EvalAuditReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface EvalAuditEvent {
  schemaVersion: "ajnas.eval.audit.v1";
  sequence: number;
  timestamp: string;
  actor: string;
  action: string;
  suiteId: string;
  suiteVersion: string;
  suiteDigest: string;
  reportDigest: string;
  caseCount: number;
  assertionCount: number;
  receipt: EvalAuditReceipt;
}

export interface EvalAuditRecordInput {
  actor: string;
  action: string;
  suite: EvalSuite;
  report: EvalReport;
}

export interface EvalAuditLedgerOptions {
  clock?: () => Date;
}

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}
