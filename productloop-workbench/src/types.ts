export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type WorkbenchRisk = "low" | "medium" | "high" | "critical";
export type WorkbenchRunStatus =
  | "planned"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type WorkbenchApprovalStatus = "pending" | "approved" | "rejected" | "consumed";

export interface WorkbenchRun {
  schemaVersion: "productloop.workbench.run.v1";
  id: string;
  title: string;
  purpose: string;
  risk: WorkbenchRisk;
  status: WorkbenchRunStatus;
  policyDecision: "allow" | "deny" | "require_approval";
  policyReason: string;
  currentStep: string;
  context: JsonObject;
  createdAt: string;
  updatedAt: string;
  previousHash: string | null;
  receiptHash: string;
}

export interface WorkbenchApproval {
  schemaVersion: "productloop.workbench.approval.v1";
  id: string;
  runId: string;
  status: WorkbenchApprovalStatus;
  toolName: string;
  effect: string;
  risk: WorkbenchRisk;
  reason: string;
  requestedBy: string;
  input: JsonValue;
  inputDigest: string;
  reviewerId?: string;
  reviewerComment?: string;
  createdAt: string;
  updatedAt: string;
  consumedAt?: string;
}

export interface WorkbenchEvidence {
  schemaVersion: "productloop.workbench.evidence.v1";
  id: string;
  runId: string;
  sourceType: "maqam" | "cockroach-browser" | "cockroach-crawler" | "productloop" | "local" | "custom";
  source: string;
  title: string;
  excerpt: string;
  uri?: string;
  contentDigest: string;
  createdAt: string;
}

export interface WorkbenchMemoryLink {
  schemaVersion: "productloop.workbench.memory-link.v1";
  id: string;
  runId: string;
  provider: "qarinah" | "custom";
  eventId: string;
  eventHash: string;
  relationship: "context" | "decision" | "outcome" | "supersedes";
  summary: string;
  createdAt: string;
}

export interface WorkbenchEvent {
  schemaVersion: "productloop.workbench.event.v1";
  id: string;
  sequence: number;
  runId: string;
  type: string;
  timestamp: string;
  data: JsonObject;
  previousHash: string | null;
  eventHash: string;
}

export interface WorkbenchPolicySummary {
  id: string;
  name: string;
  effect: "allow" | "deny" | "require_approval";
  description: string;
  scope: string;
}

export interface WorkbenchSnapshot {
  schemaVersion: "productloop.workbench.snapshot.v1";
  generatedAt: string;
  runs: WorkbenchRun[];
  approvals: WorkbenchApproval[];
  evidence: WorkbenchEvidence[];
  memory: WorkbenchMemoryLink[];
  policies: WorkbenchPolicySummary[];
  integrity: WorkbenchIntegrityReport;
}

export interface WorkbenchIntegrityReport {
  valid: boolean;
  eventCount: number;
  headHash: string | null;
  issues: string[];
}

export interface WorkbenchProofBundle {
  schemaVersion: "productloop.workbench.proof-bundle.v1";
  exportedAt: string;
  run: WorkbenchRun;
  approvals: WorkbenchApproval[];
  evidence: WorkbenchEvidence[];
  memory: WorkbenchMemoryLink[];
  events: WorkbenchEvent[];
  integrity: WorkbenchIntegrityReport;
  bundleDigest: string;
}

export interface CreateRunInput {
  id?: string;
  title: string;
  purpose: string;
  risk?: WorkbenchRisk;
  status?: WorkbenchRunStatus;
  policyDecision?: WorkbenchRun["policyDecision"];
  policyReason?: string;
  currentStep?: string;
  context?: JsonObject;
}

export interface RequestApprovalInput {
  id?: string;
  runId: string;
  toolName: string;
  effect: string;
  risk: WorkbenchRisk;
  reason: string;
  requestedBy: string;
  input: JsonValue;
}

export interface ReviewApprovalInput {
  reviewerId: string;
  decision: "approve" | "reject";
  comment?: string;
}

export interface AddEvidenceInput {
  id?: string;
  runId: string;
  sourceType: WorkbenchEvidence["sourceType"];
  source: string;
  title: string;
  excerpt: string;
  uri?: string;
}

export interface AddMemoryLinkInput {
  id?: string;
  runId: string;
  provider: WorkbenchMemoryLink["provider"];
  eventId: string;
  eventHash: string;
  relationship: WorkbenchMemoryLink["relationship"];
  summary: string;
}
