export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type ApprovalRisk = "low" | "medium" | "high" | "critical";
export type ApprovalSubjectKind =
  | "runtime-tool"
  | "connector-invocation"
  | "package-release"
  | "policy-exception"
  | "provenance-export"
  | "custom";
export type ApprovalReviewerKind = "user" | "group" | "role";
export type ApprovalQuorumStrategy = "any" | "all" | "majority" | "count";
export type ApprovalTicketStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled" | "escalated";
export type ApprovalReviewDecision = "approve" | "reject";
export type ApprovalDecisionStatus = "approved" | "rejected";

export interface ApprovalWorkflow {
  schemaVersion: "ajnas.approval.workflow.v1";
  id: string;
  version: string;
  name: string;
  owner: string;
  description?: string;
  stages: ApprovalStage[];
  policy?: ApprovalWorkflowPolicy;
  metadata?: JsonObject;
}

export interface ApprovalWorkflowPolicy {
  defaultTtlHours?: number;
  requireReasonForRejection?: boolean;
  preventRequesterSelfApproval?: boolean;
  maxDelegationDepth?: number;
  allowedRiskLevels?: ApprovalRisk[];
  sensitiveDataClasses?: string[];
}

export interface ApprovalStage {
  id: string;
  name: string;
  reviewers: ApprovalReviewer[];
  quorum: ApprovalQuorum;
  escalation?: ApprovalEscalation;
  conditions?: ApprovalCondition[];
}

export interface ApprovalReviewer {
  id: string;
  kind: ApprovalReviewerKind;
  displayName?: string;
  required?: boolean;
}

export interface ApprovalQuorum {
  strategy: ApprovalQuorumStrategy;
  required?: number;
}

export interface ApprovalEscalation {
  afterHours: number;
  notify: string[];
  stageId?: string;
}

export interface ApprovalCondition {
  field: string;
  equals?: JsonValue;
  includes?: JsonValue;
}

export interface ApprovalSubject {
  id: string;
  kind: ApprovalSubjectKind;
  title: string;
  summary: string;
  risk: ApprovalRisk;
  requestedAction: string;
  destinations?: string[];
  dataClasses?: string[];
  artifactDigests?: string[];
  metadata?: JsonObject;
}

export interface RuntimePolicyRequest {
  runId: string;
  stepId: string;
  tool: {
    name: string;
    description?: string;
    risk?: ApprovalRisk | string;
  };
  input: unknown;
  metadata?: JsonObject;
}

export type RuntimePolicyDecision =
  | {
      decision: "allow";
      reason: string;
      metadata?: JsonObject;
    }
  | {
      decision: "deny";
      reason: string;
      metadata?: JsonObject;
    }
  | {
      decision: "require_approval";
      reason: string;
      approvalPrompt?: string;
      metadata?: JsonObject;
    };

export interface ConnectorTrustEvaluationLike {
  decision: "allow" | "require_approval" | "deny" | string;
  reasons?: string[];
  approvalPrompt?: string;
  connectorId: string;
  connectorVersion?: string;
  manifestDigest?: string;
  risk?: ApprovalRisk | string;
  operation?: string;
  capabilityId?: string;
  dataClasses?: string[];
  destinations?: string[];
  metadata?: JsonObject;
}

export interface ReleaseApprovalSubjectInput {
  packageName: string;
  version: string;
  requestedAction?: string;
  destinations?: string[];
  artifactDigests?: string[];
  changeSummary: string;
  risk?: ApprovalRisk;
  metadata?: JsonObject;
}

export interface ApprovalRequestInput {
  workflow: ApprovalWorkflow;
  subject: ApprovalSubject;
  requestedBy: string;
  reason: string;
  createdAt?: string | Date;
  policyDecision?: RuntimePolicyDecision;
  connectorTrust?: ConnectorTrustEvaluationLike;
  provenance?: JsonObject;
  metadata?: JsonObject;
}

export interface ApprovalRequestDocument {
  subject: ApprovalSubject;
  requestedBy: string;
  reason: string;
  policyDecision?: RuntimePolicyDecision;
  connectorTrust?: ConnectorTrustEvaluationLike;
  provenance?: JsonObject;
  metadata?: JsonObject;
}

export interface ApprovalReviewInput {
  reviewerId: string;
  decision: ApprovalReviewDecision;
  comment?: string;
  reviewedAt?: string | Date;
  metadata?: JsonObject;
}

export interface ApprovalDelegationInput {
  fromReviewerId: string;
  toReviewer: ApprovalReviewer;
  reason: string;
  delegatedAt?: string | Date;
  metadata?: JsonObject;
}

export interface ApprovalCancelInput {
  actorId: string;
  reason: string;
  cancelledAt?: string | Date;
  metadata?: JsonObject;
}

export interface ApprovalDecisionRecord {
  reviewerId: string;
  decision: ApprovalDecisionStatus;
  stageId: string;
  comment?: string;
  decidedAt: string;
  metadata?: JsonObject;
}

export interface ApprovalDelegationRecord {
  fromReviewerId: string;
  toReviewer: ApprovalReviewer;
  stageId: string;
  reason: string;
  delegatedAt: string;
  depth: number;
  metadata?: JsonObject;
}

export type ApprovalHistoryEventType =
  | "approval.requested"
  | "approval.reviewed"
  | "approval.stage_advanced"
  | "approval.delegated"
  | "approval.escalated"
  | "approval.expired"
  | "approval.cancelled";

export interface ApprovalHistoryEvent {
  sequence: number;
  timestamp: string;
  type: ApprovalHistoryEventType;
  actorId: string;
  stageId: string;
  status: ApprovalTicketStatus;
  message: string;
  metadata?: JsonObject;
}

export interface ApprovalTicket {
  schemaVersion: "ajnas.approval.ticket.v1";
  id: string;
  workflowId: string;
  workflowVersion: string;
  workflowDigest: string;
  status: ApprovalTicketStatus;
  stageId: string;
  stageStartedAt: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  requestedBy: string;
  reason: string;
  subject: ApprovalSubject;
  policyDecision?: RuntimePolicyDecision;
  connectorTrust?: ConnectorTrustEvaluationLike;
  provenance?: JsonObject;
  decisions: ApprovalDecisionRecord[];
  delegations: ApprovalDelegationRecord[];
  history: ApprovalHistoryEvent[];
  metadata?: JsonObject;
}

export interface ApprovalQueueOptions {
  clock?: () => Date;
  audit?: ApprovalAuditLedger;
  tickets?: ApprovalTicket[];
}

export interface ApprovalQueueQuery {
  status?: ApprovalTicketStatus;
  workflowId?: string;
  subjectKind?: ApprovalSubjectKind;
  requestedBy?: string;
}

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

export interface ApprovalAuditLedgerOptions {
  clock?: () => Date;
}

export type ApprovalAuditEventType =
  | "approval.requested"
  | "approval.reviewed"
  | "approval.delegated"
  | "approval.escalated"
  | "approval.expired"
  | "approval.cancelled"
  | "approval.snapshot_exported";

export interface ApprovalAuditReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface ApprovalAuditEvent {
  schemaVersion: "ajnas.approval.audit.v1";
  sequence: number;
  timestamp: string;
  eventType: ApprovalAuditEventType;
  ticketId: string;
  workflowId: string;
  subjectId: string;
  actorId: string;
  status: ApprovalTicketStatus;
  ticketDigest: string;
  reason?: string;
  metadata?: JsonObject;
  receipt: ApprovalAuditReceipt;
}

export interface ApprovalAuditRecordInput {
  eventType: ApprovalAuditEventType;
  ticket: ApprovalTicket;
  actorId: string;
  reason?: string;
  metadata?: JsonObject;
}

export interface ApprovalAuditLedger {
  events: ApprovalAuditEvent[];
  record(input: ApprovalAuditRecordInput): ApprovalAuditEvent;
  verify(): VerificationResult;
}

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}
