import type { KeyObject } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type SkillRisk = "low" | "medium" | "high" | "critical";
export type SkillLicense = "MIT" | "Apache-2.0" | "BSD-2-Clause" | "BSD-3-Clause" | "ISC" | string;
export type EntrypointType = "module" | "command" | "mcp";
export type TrustSource = "first-party" | "vendor" | "community";
export type NetworkPermission = "none" | "allowlist";
export type FilesystemPermission = "none" | "read" | "write";
export type HumanApprovalMode = "never" | "on_high_risk" | "always";

export interface SkillManifest {
  schemaVersion: "ajnas.skill.v1";
  id: string;
  name: string;
  version: string;
  description: string;
  license: SkillLicense;
  entrypoint: {
    type: EntrypointType;
    value: string;
  };
  compatibility: {
    ajnasRuntime: string;
    [key: string]: string;
  };
  capabilities: SkillCapability[];
  permissions: SkillPermissions;
  trust: SkillTrust;
  metadata?: JsonObject;
}

export interface SkillCapability {
  name: string;
  description: string;
  risk: SkillRisk;
  inputSchema?: JsonObject;
  outputSchema?: JsonObject;
}

export interface SkillPermissions {
  network: NetworkPermission;
  allowlist?: string[];
  filesystem: FilesystemPermission;
  externalPublish: boolean;
  secrets?: string[];
  humanApproval: HumanApprovalMode;
}

export interface SkillTrust {
  source: TrustSource;
  publisher: string;
  repository: string;
  commit?: string;
  reviewedBy?: string[];
  licenseEvidence: {
    kind: "repository" | "package" | "manual";
    checkedAt: string;
    url?: string;
  };
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type SignatureAlgorithm = "ed25519";
export type KeyMaterial = KeyObject | string | Buffer;

export interface SkillSignature {
  algorithm: SignatureAlgorithm;
  keyId: string;
  signedAt: string;
  value: string;
}

export interface SignedSkillManifest {
  manifest: SkillManifest;
  digest: string;
  signature: SkillSignature;
}

export interface RegistryRecord {
  manifest: SkillManifest;
  signed?: SignedSkillManifest;
  digest: string;
  registeredAt: string;
  registeredBy: string;
  source: string;
}

export interface RegisterSkillOptions {
  actor: string;
  source: string;
}

export interface AuditReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface SkillAuditEvent {
  sequence: number;
  timestamp: string;
  type: string;
  actor: string;
  skillId: string;
  version: string;
  digest: string;
  data: JsonObject;
  receipt: AuditReceipt;
}

export interface SkillAuditLedgerOptions {
  clock?: () => Date;
}

export interface SkillRegistryOptions {
  audit?: SkillAuditSink;
  keyResolver?: (keyId: string) => KeyMaterial | null;
  clock?: () => Date;
}

export interface SkillAuditSink {
  record(event: Omit<SkillAuditEvent, "sequence" | "timestamp" | "receipt">): SkillAuditEvent;
}

export interface RuntimeToolDefinition {
  name: string;
  description: string;
  risk: SkillRisk;
  execute: (context: unknown) => unknown;
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
  evaluate(request: RuntimePolicyRequest): Promise<RuntimePolicyDecision> | RuntimePolicyDecision;
}

export interface SkillInstallPolicyOptions {
  toolName?: string;
  trustedPublishers?: string[];
  highRiskRequiresApproval?: boolean;
}

export interface SignSkillManifestOptions {
  algorithm: SignatureAlgorithm;
  keyId: string;
  privateKey: KeyMaterial;
  signedAt?: string;
  clock?: () => Date;
}

export interface SkillApprovalQueueOptions {
  clock?: () => Date;
}

export interface EnqueueSkillApprovalInput {
  skillId: string;
  version: string;
  digest: string;
  reason: string;
  requestedBy: string;
  manifest: SkillManifest;
}

export interface SkillApprovalResolution {
  approved: boolean;
  approverId: string;
  comment?: string;
  metadata?: JsonObject;
}

export interface SkillApprovalRequest extends EnqueueSkillApprovalInput {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
  resolution?: SkillApprovalResolution;
}
