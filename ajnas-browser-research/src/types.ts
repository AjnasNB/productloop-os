import type { KeyObject } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface VerificationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type BrowserResearchAction = "search" | "open" | "extract" | "crawl" | "note";
export type BrowserResearchStatus = "passed" | "failed" | "denied" | "awaiting_approval";
export type BrowserStepStatus = "completed" | "failed" | "denied" | "awaiting_approval";
export type PolicyEffect = "allow" | "deny" | "require_approval";

export interface BrowserResearchPolicy {
  allowedOrigins?: string[];
  blockedOrigins?: string[];
  allowedActions?: BrowserResearchAction[];
  maxSteps?: number;
  requireApprovalForActions?: BrowserResearchAction[];
  citationRequired?: boolean;
  retainFullText?: boolean;
  metadata?: JsonObject;
}

export interface BrowserResearchOutputRequirements {
  requireCitations?: boolean;
  exportProvenance?: boolean;
  format?: "json" | "jsonl" | "markdown";
}

export interface BrowserResearchStep {
  id: string;
  action: BrowserResearchAction;
  purpose: string;
  url?: string;
  query?: string;
  selector?: string;
  maxPages?: number;
  requiresApproval?: boolean;
  metadata?: JsonObject;
}

export interface BrowserResearchPlan {
  schema: "ajnas.browser.research.plan.v1";
  id: string;
  objective: string;
  createdAt?: string;
  policy?: BrowserResearchPolicy;
  steps: BrowserResearchStep[];
  output?: BrowserResearchOutputRequirements;
  metadata?: JsonObject;
}

export interface BrowserResearchPolicyDecision {
  effect: PolicyEffect;
  reasons: string[];
  action: BrowserResearchAction;
  origin?: string;
  stepId: string;
  policyDigest: string;
}

export interface ApprovalGateRequest {
  schema: "ajnas.browser.research.approval-request.v1";
  id: string;
  runId: string;
  planId: string;
  stepId: string;
  action: BrowserResearchAction;
  reason: string;
  inputDigest: string;
  policyDigest: string;
  createdAt: string;
  status: "pending";
}

export interface ApprovalGateResolution {
  requestId: string;
  status: "approved" | "rejected";
  reviewer: string;
  decidedAt: string;
  reason?: string;
  metadata?: JsonObject;
}

export interface SearchResult {
  url: string;
  title?: string;
  snippet?: string;
  rank?: number;
  metadata?: JsonObject;
}

export interface SearchAdapterOutput {
  results: SearchResult[];
  metadata?: JsonObject;
}

export interface OpenAdapterOutput {
  url: string;
  finalUrl?: string;
  title?: string;
  text?: string;
  citations?: ResearchCitationInput[];
  metadata?: JsonObject;
}

export interface ExtractionClaim {
  text: string;
  citation?: ResearchCitationInput;
  confidence?: number;
  metadata?: JsonObject;
}

export interface ExtractAdapterOutput {
  url: string;
  title?: string;
  claims: ExtractionClaim[];
  citations?: ResearchCitationInput[];
  metadata?: JsonObject;
}

export interface CrawlPage {
  url: string;
  title?: string;
  text?: string;
  snippet?: string;
  depth?: number;
  metadata?: JsonObject;
}

export interface CrawlAdapterOutput {
  pages: CrawlPage[];
  metadata?: JsonObject;
}

export interface NoteAdapterOutput {
  note: string;
  citations?: ResearchCitationInput[];
  metadata?: JsonObject;
}

export type BrowserAdapterOutput =
  | SearchAdapterOutput
  | OpenAdapterOutput
  | ExtractAdapterOutput
  | CrawlAdapterOutput
  | NoteAdapterOutput;

export interface BrowserResearchAdapterInput {
  runId: string;
  plan: BrowserResearchPlan;
  step: BrowserResearchStep;
  inputDigest: string;
}

export interface BrowserResearchAdapter {
  search?(input: BrowserResearchAdapterInput): Promise<SearchAdapterOutput> | SearchAdapterOutput;
  open?(input: BrowserResearchAdapterInput): Promise<OpenAdapterOutput> | OpenAdapterOutput;
  extract?(input: BrowserResearchAdapterInput): Promise<ExtractAdapterOutput> | ExtractAdapterOutput;
  crawl?(input: BrowserResearchAdapterInput): Promise<CrawlAdapterOutput> | CrawlAdapterOutput;
  note?(input: BrowserResearchAdapterInput): Promise<NoteAdapterOutput> | NoteAdapterOutput;
}

export interface ReplayBrowserAdapterRecord {
  stepId: string;
  action: BrowserResearchAction;
  output: BrowserAdapterOutput;
}

export interface ResearchCitationInput {
  url: string;
  title?: string;
  locator?: string;
  quote?: string;
  capturedAt?: string;
  metadata?: JsonObject;
}

export interface ResearchCitation {
  id: string;
  stepId: string;
  url: string;
  title?: string;
  locator?: string;
  quote?: string;
  excerptHash: string;
  evidenceDigest: string;
  capturedAt: string;
  metadata?: JsonObject;
}

export interface BrowserStepLog {
  schema: "ajnas.browser.research.step-log.v1";
  index: number;
  id: string;
  action: BrowserResearchAction;
  status: BrowserStepStatus;
  purpose: string;
  startedAt: string;
  endedAt: string;
  inputDigest: string;
  outputDigest?: string;
  outputSummary?: JsonObject;
  policyDecision: BrowserResearchPolicyDecision;
  citations: ResearchCitation[];
  approvalRequest?: ApprovalGateRequest;
  approvalResolution?: ApprovalGateResolution;
  error?: string;
  digest: string;
}

export interface BrowserResearchAuditEvent {
  type:
    | "run_started"
    | "policy_decision"
    | "approval_requested"
    | "approval_resolved"
    | "step_completed"
    | "run_completed";
  runId: string;
  stepId?: string;
  at: string;
  payload: JsonObject;
}

export interface BrowserResearchAuditReceipt {
  schema: "ajnas.browser.research.audit-receipt.v1";
  index: number;
  at: string;
  eventType: BrowserResearchAuditEvent["type"];
  runId: string;
  stepId?: string;
  payloadHash: string;
  previousHash: string | null;
  hash: string;
}

export interface BrowserResearchAuditLedgerOptions {
  now?: () => string;
  previousHash?: string | null;
}

export interface BrowserResearchSummary {
  stepsPlanned: number;
  stepsRun: number;
  citationsCaptured: number;
  deniedSteps: number;
  approvalRequests: number;
  failedSteps: number;
}

export interface BrowserResearchReport {
  schema: "ajnas.browser.research.report.v1";
  runId: string;
  planId: string;
  planDigest: string;
  objective: string;
  status: BrowserResearchStatus;
  startedAt: string;
  completedAt: string;
  steps: BrowserStepLog[];
  citations: ResearchCitation[];
  summary: BrowserResearchSummary;
  audit: BrowserResearchAuditReceipt[];
  digest: string;
}

export interface BrowserResearchHarnessOptions {
  adapter: BrowserResearchAdapter;
  auditLedger?: BrowserResearchAuditLedgerLike;
  approvalProvider?: (request: ApprovalGateRequest) => Promise<ApprovalGateResolution> | ApprovalGateResolution | undefined;
  now?: () => string;
  runId?: string;
}

export interface BrowserResearchAuditLedgerLike {
  receipts: BrowserResearchAuditReceipt[];
  record(event: BrowserResearchAuditEvent): BrowserResearchAuditReceipt;
}

export interface ResearchProvenanceBundle {
  schema: "ajnas.browser.research.provenance-bundle.v1";
  runId: string;
  planId: string;
  reportDigest: string;
  planDigest: string;
  generatedAt: string;
  citations: ResearchCitation[];
  receipts: BrowserResearchAuditReceipt[];
  digest: string;
  signature?: ResearchProvenanceSignature;
}

export interface ResearchProvenanceSignature {
  algorithm: "ed25519" | "rsa-sha256" | "ecdsa-sha256";
  keyId: string;
  value: string;
}

export interface SignResearchProvenanceOptions {
  privateKey: KeyObject | string | Buffer;
  keyId: string;
  algorithm?: ResearchProvenanceSignature["algorithm"];
}

export interface VerifyResearchProvenanceOptions {
  publicKey: KeyObject | string | Buffer;
}
