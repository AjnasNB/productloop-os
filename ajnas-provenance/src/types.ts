import type { KeyObject } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface TraceSubject {
  type: string;
  id: string;
  metadata?: JsonObject;
}

export interface TraceSource {
  system: string;
  id: string;
  uri?: string;
  version?: string;
  metadata?: JsonObject;
}

export interface TraceLink {
  rel: string;
  href: string;
  digest?: string;
}

export interface ProvenanceReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface ProvenanceTraceEvent {
  schemaVersion: "ajnas.provenance.event.v1";
  traceId: string;
  sequence: number;
  timestamp: string;
  actor: string;
  action: string;
  subject: TraceSubject;
  source: TraceSource;
  data: JsonObject;
  links: TraceLink[];
  receipt: ProvenanceReceipt;
}

export interface RecordTraceEventInput {
  actor: string;
  action: string;
  subject: TraceSubject;
  source: TraceSource;
  data?: JsonObject;
  links?: TraceLink[];
}

export interface TraceLedgerOptions {
  traceId?: string;
  clock?: () => Date;
  redactionKeys?: string[];
}

export interface VerificationResult {
  valid: boolean;
  issues: string[];
}

export interface RuntimeReceiptLike {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export interface RuntimeEventLike {
  runId: string;
  sequence: number;
  type: string;
  timestamp: string;
  data: JsonObject;
  receipt: RuntimeReceiptLike;
}

export interface SkillAuditEventLike {
  sequence: number;
  timestamp: string;
  type: string;
  actor: string;
  skillId: string;
  version: string;
  digest: string;
  data: JsonObject;
  receipt: RuntimeReceiptLike;
}

export interface ImportOptions {
  actor?: string;
}

export interface TraceBundle {
  schemaVersion: "ajnas.provenance.bundle.v1";
  generatedAt: string;
  generatedBy: string;
  purpose: string;
  eventCount: number;
  rootHash: string | null;
  events: ProvenanceTraceEvent[];
  digest: string;
}

export interface CreateTraceBundleOptions {
  generatedAt?: string;
  generatedBy: string;
  purpose: string;
}

export type SignatureAlgorithm = "ed25519";
export type KeyMaterial = KeyObject | string | Buffer;

export interface TraceBundleSignature {
  algorithm: SignatureAlgorithm;
  keyId: string;
  signedAt: string;
  value: string;
}

export interface SignedTraceBundle {
  bundle: TraceBundle;
  digest: string;
  signature: TraceBundleSignature;
}

export interface SignTraceBundleOptions {
  algorithm: SignatureAlgorithm;
  keyId: string;
  privateKey: KeyMaterial;
  signedAt?: string;
  clock?: () => Date;
}

export interface RuntimeToolDefinition {
  name: string;
  description: string;
  risk: string;
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

export interface ProvenanceExportPolicyOptions {
  toolName?: string;
  blockedDestinations?: string[];
  approvalDestinations?: string[];
  sensitiveDataClasses?: string[];
}
