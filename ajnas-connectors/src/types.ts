export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type ConnectorKind = "mcp" | "rest" | "browser" | "search" | "crawl" | "github" | "npm" | "publish" | "custom";
export type ConnectorTransport = "stdio" | "http" | "sse" | "websocket" | "browser" | "local";
export type ConnectorOperation = "read" | "write" | "execute" | "search" | "crawl" | "publish" | "delete";
export type ConnectorRisk = "low" | "medium" | "high" | "critical";
export type ConnectorDataClass = "public" | "internal" | "confidential" | "personal" | "credential" | "secret";
export type ConnectorAuthType = "none" | "api_key" | "oauth2" | "bearer" | "basic" | "custom";
export type ConnectorReviewStatus = "unreviewed" | "reviewed" | "approved" | "blocked";
export type ConnectorTrustDecision = "allow" | "require_approval" | "deny";
export type ConnectorFilesystemAccess = "none" | "read" | "write";
export type ConnectorNetworkAccess = "none" | "restricted" | "external";
export type ConnectorSecretAccess = "none" | "read";

export interface ConnectorManifest {
  schemaVersion: "ajnas.connector.manifest.v1";
  id: string;
  version: string;
  name: string;
  description: string;
  kind: ConnectorKind;
  publisher: ConnectorPublisher;
  runtime: ConnectorRuntime;
  auth: ConnectorAuth;
  permissions: ConnectorPermission[];
  capabilities: ConnectorCapability[];
  trust: ConnectorTrustMetadata;
  policyHints?: ConnectorPolicyHints;
  metadata?: JsonObject;
}

export interface ConnectorPublisher {
  name: string;
  url?: string;
  contact?: string;
}

export interface ConnectorRuntime {
  transport: ConnectorTransport;
  entrypoint?: string;
  node?: string;
  protocol?: string;
  environment?: JsonObject;
}

export interface ConnectorAuth {
  type: ConnectorAuthType;
  secretRefs?: string[];
  scopes?: string[];
  metadata?: JsonObject;
}

export interface ConnectorPermission {
  id: string;
  purpose: string;
  operations: ConnectorOperation[];
  resources: string[];
  dataClasses: ConnectorDataClass[];
  destinations: string[];
  risk: ConnectorRisk;
}

export interface ConnectorCapability {
  id: string;
  name: string;
  description: string;
  operations: ConnectorOperation[];
  dataClasses: ConnectorDataClass[];
  destinations: string[];
  risk: ConnectorRisk;
  requiresApproval?: boolean;
  inputSchema?: JsonObject;
  outputSchema?: JsonObject;
  metadata?: JsonObject;
}

export interface ConnectorTrustMetadata {
  license: string;
  reviewStatus: ConnectorReviewStatus;
  sourceUrl?: string;
  homepageUrl?: string;
  packageName?: string;
  packageVersion?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  provenance?: ConnectorProvenanceReference;
  sandbox?: ConnectorSandboxMetadata;
  attestations?: ConnectorTrustAttestation[];
}

export interface ConnectorProvenanceReference {
  receiptDigest?: string;
  sourceDigest?: string;
  signedBy?: string;
  statementType?: string;
}

export interface ConnectorSandboxMetadata {
  network: ConnectorNetworkAccess;
  filesystem: ConnectorFilesystemAccess;
  secrets: ConnectorSecretAccess;
  egressDestinations?: string[];
}

export interface ConnectorTrustAttestation {
  id: string;
  kind: "license" | "security-review" | "provenance" | "sandbox" | "data-processing" | "custom";
  statement: string;
  evidence?: string;
  signedBy?: string;
  issuedAt?: string;
}

export interface ConnectorPolicyHints {
  approvalRequiredFor?: ConnectorPolicySelector;
  deniedFor?: ConnectorPolicySelector;
  defaultPurpose?: string;
}

export interface ConnectorPolicySelector {
  operations?: ConnectorOperation[];
  capabilities?: string[];
  dataClasses?: ConnectorDataClass[];
  destinations?: string[];
  risks?: ConnectorRisk[];
}

export interface ConnectorInvocationRequest {
  runId: string;
  stepId: string;
  connectorId: string;
  capabilityId: string;
  operation: ConnectorOperation;
  purpose: string;
  input: unknown;
  requestedBy?: string;
  metadata?: JsonObject;
}

export interface RuntimeToolDefinition {
  name: string;
  description?: string;
  risk?: ConnectorRisk;
}

export interface RuntimePolicyRequest {
  runId: string;
  stepId: string;
  tool: RuntimeToolDefinition;
  input: unknown;
  metadata: JsonObject;
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

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ConnectorTrustPolicy {
  allowedLicenses?: string[];
  requireSourceUrl?: boolean;
  requireReviewForRisks?: ConnectorRisk[];
  requireApprovalForOperations?: ConnectorOperation[];
  blockedOperations?: ConnectorOperation[];
  blockedDataClasses?: ConnectorDataClass[];
  allowedDestinations?: string[];
}

export interface ConnectorTrustEvaluationOptions {
  request?: Partial<ConnectorInvocationRequest>;
  policy?: ConnectorTrustPolicy;
}

export interface ConnectorTrustEvaluation {
  decision: ConnectorTrustDecision;
  reasons: string[];
  approvalPrompt?: string;
  manifestDigest: string;
  connectorId: string;
  connectorVersion: string;
  risk: ConnectorRisk;
  operation?: ConnectorOperation;
  capabilityId?: string;
  dataClasses: ConnectorDataClass[];
  destinations: string[];
  metadata: JsonObject;
}

export interface ConnectorRegistryQuery {
  kind?: ConnectorKind;
  operation?: ConnectorOperation;
  capabilityId?: string;
  destination?: string;
  dataClass?: ConnectorDataClass;
}

export interface ConnectorRegistryOptions {
  audit?: ConnectorAuditLedger;
}

export interface ConnectorRegisterOptions {
  actorId?: string;
}

export interface ConnectorAuditLedgerOptions {
  clock?: () => Date;
}

export type ConnectorAuditEventType =
  | "connector.registered"
  | "connector.trust_evaluated"
  | "connector.invocation_requested"
  | "connector.approval_requested"
  | "connector.approval_resolved";

export interface ConnectorAuditReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface ConnectorAuditEvent {
  schemaVersion: "ajnas.connector.audit.v1";
  sequence: number;
  timestamp: string;
  eventType: ConnectorAuditEventType;
  connectorId: string;
  connectorVersion?: string;
  actorId: string;
  manifestDigest?: string;
  requestDigest?: string;
  decision?: ConnectorTrustDecision | "approved" | "rejected";
  reason?: string;
  metadata?: JsonObject;
  receipt: ConnectorAuditReceipt;
}

export interface ConnectorAuditRecordInput {
  eventType: ConnectorAuditEventType;
  connectorId: string;
  connectorVersion?: string;
  actorId: string;
  manifest?: ConnectorManifest;
  request?: unknown;
  decision?: ConnectorTrustDecision | "approved" | "rejected";
  reason?: string;
  metadata?: JsonObject;
}

export interface VerificationResult {
  valid: boolean;
  issues: string[];
}

export interface ConnectorAuditLedger {
  events: ConnectorAuditEvent[];
  record(input: ConnectorAuditRecordInput): ConnectorAuditEvent;
  verify(): VerificationResult;
}

export interface ConnectorApprovalQueueOptions {
  clock?: () => Date;
}

export interface ConnectorApprovalRequestInput {
  manifest: ConnectorManifest;
  invocation?: ConnectorInvocationRequest;
  trustEvaluation?: ConnectorTrustEvaluation;
  reason: string;
  requestedBy: string;
  metadata?: JsonObject;
}

export interface ConnectorApprovalResolution {
  approved: boolean;
  approverId: string;
  comment?: string;
  metadata?: JsonObject;
}

export interface ConnectorApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  connectorId: string;
  connectorVersion: string;
  manifestDigest: string;
  reason: string;
  requestedBy: string;
  invocation?: JsonObject;
  trustEvaluation?: JsonObject;
  metadata?: JsonObject;
  resolution?: ConnectorApprovalResolution;
}

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}
