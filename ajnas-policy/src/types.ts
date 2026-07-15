export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type PolicyEffect = "allow" | "deny" | "require_approval";
export type PolicyDefaultEffect = "allow" | "deny";
export type ToolRisk = "low" | "medium" | "high" | "critical";

export interface RuntimeToolDefinition {
  name: string;
  description?: string;
  risk?: ToolRisk | string;
}

export interface RuntimePolicyRequest {
  runId: string;
  stepId: string;
  tool: RuntimeToolDefinition;
  input: unknown;
  metadata: Record<string, unknown>;
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

export interface RuntimePolicyEngine {
  evaluate(request: RuntimePolicyRequest): RuntimePolicyDecision | Promise<RuntimePolicyDecision>;
}

export interface PolicyBundle {
  schemaVersion: "ajnas.policy.bundle.v1";
  id: string;
  version: string;
  description?: string;
  owner?: string;
  defaultEffect: PolicyDefaultEffect;
  rules: PolicyRule[];
  metadata?: JsonObject;
}

export interface PolicyRule {
  id: string;
  description?: string;
  effect: PolicyEffect;
  reason: string;
  approvalPrompt?: string;
  priority?: number;
  enabled?: boolean;
  match: PolicyMatch;
}

export interface PolicyMatch {
  toolNames?: string[];
  toolNamePatterns?: string[];
  risks?: string[];
  purposes?: string[];
  destinations?: string[];
  dataClasses?: string[];
  publishers?: string[];
  capabilities?: string[];
  metadata?: Record<string, JsonValue>;
  input?: Record<string, JsonValue>;
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

export interface ExtractedPolicyContext {
  toolName: string;
  risk: string;
  purpose: string | null;
  destination: string | null;
  dataClasses: string[];
  publisher: string | null;
  capabilities: string[];
}

export interface PolicyDecisionLedgerOptions {
  clock?: () => Date;
}

export interface PolicyDecisionReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface PolicyDecisionEvent {
  schemaVersion: "ajnas.policy.decision.v1";
  sequence: number;
  timestamp: string;
  policyBundleId: string;
  policyBundleVersion: string;
  runId: string;
  stepId: string;
  toolName: string;
  decision: PolicyEffect;
  reason: string;
  matchedRuleIds: string[];
  selectedRuleId: string | null;
  requestDigest: string;
  receipt: PolicyDecisionReceipt;
}

export interface PolicyDecisionAuditInput {
  bundle: PolicyBundle;
  request: RuntimePolicyRequest;
  decision: RuntimePolicyDecision;
}

export interface VerificationResult {
  valid: boolean;
  issues: string[];
}

export interface DeclarativePolicyEngineOptions {
  bundle: PolicyBundle;
  audit?: PolicyDecisionLedger;
}

export interface PolicyDecisionLedger {
  events: PolicyDecisionEvent[];
  record(input: PolicyDecisionAuditInput): PolicyDecisionEvent;
}

export interface PolicyApprovalQueueOptions {
  clock?: () => Date;
}

export interface PolicyApprovalRequestInput {
  policyBundleId: string;
  ruleId?: string;
  reason: string;
  requestedBy: string;
  request: RuntimePolicyRequest;
  metadata?: JsonObject;
}

export interface PolicyApprovalResolution {
  approved: boolean;
  approverId: string;
  comment?: string;
  metadata?: JsonObject;
}

export interface PolicyApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  policyBundleId: string;
  ruleId?: string;
  reason: string;
  requestedBy: string;
  request: JsonObject;
  metadata?: JsonObject;
  resolution?: PolicyApprovalResolution;
}

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}
