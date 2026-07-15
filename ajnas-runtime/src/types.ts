export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type ToolRisk = "low" | "medium" | "high" | "critical";

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  risk: ToolRisk;
  inputSchema?: JsonObject;
  execute(context: ToolExecutionContext<TInput>): Promise<TOutput> | TOutput;
}

export interface ToolExecutionContext<TInput = unknown> {
  runId: string;
  stepId: string;
  toolName: string;
  input: TInput;
  metadata: ToolCallMetadata;
  approval?: ApprovalResponse;
}

export interface ToolCallMetadata {
  purpose?: string;
  risk?: ToolRisk;
  [key: string]: unknown;
}

export interface PolicyRequest {
  runId: string;
  stepId: string;
  tool: ToolDefinition;
  input: unknown;
  metadata: ToolCallMetadata;
}

export type PolicyDecision =
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

export interface PolicyEngine {
  evaluate(request: PolicyRequest): Promise<PolicyDecision> | PolicyDecision;
}

export interface ApprovalRequest {
  runId: string;
  stepId: string;
  toolName: string;
  risk: ToolRisk;
  input: unknown;
  reason: string;
  prompt?: string;
  metadata: ToolCallMetadata;
  /** SHA-256 digest of the exact run/step/tool/input/policy context being approved. */
  bindingDigest: string;
}

export interface ApprovalResponse {
  approved: boolean;
  approverId: string;
  comment?: string;
  metadata?: JsonObject;
  /** Must exactly echo the ApprovalRequest.bindingDigest. */
  bindingDigest: string;
}

export interface Approver {
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> | ApprovalResponse;
}

export interface WorkflowStep<TInput = unknown> {
  id: string;
  description?: string;
  run(context: WorkflowContext<TInput>): Promise<unknown> | unknown;
}

export interface WorkflowDefinition<TInput = unknown> {
  name: string;
  input?: TInput;
  steps: WorkflowStep<TInput>[];
}

export interface WorkflowContext<TInput = unknown> {
  runId: string;
  stepId: string;
  input: TInput;
  outputs: Record<string, unknown>;
  callTool<TToolInput = unknown, TToolOutput = unknown>(
    toolName: string,
    input: TToolInput,
    metadata?: ToolCallMetadata
  ): Promise<TToolOutput>;
  emit(type: string, data?: JsonObject): Promise<RuntimeEvent>;
}

export type RuntimeEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "tool.requested"
  | "tool.completed"
  | "tool.failed"
  | "policy.evaluated"
  | "policy.denied"
  | "approval.requested"
  | "approval.resolved"
  | string;

export interface RuntimeEvent {
  runId: string;
  sequence: number;
  type: RuntimeEventType;
  timestamp: string;
  data: JsonObject;
  receipt: ProvenanceReceipt;
}

export interface ProvenanceReceipt {
  eventHash: string;
  previousHash: string | null;
  canonicalJson: string;
}

export type RunStatus = "running" | "completed" | "failed";

export interface RunSnapshot {
  runId: string;
  name: string;
  status: RunStatus;
  input: unknown;
  outputs: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
  events: RuntimeEvent[];
}

export interface ProvenanceSink {
  record(event: RuntimeEvent): Promise<void> | void;
}

export interface RunStore {
  save(snapshot: RunSnapshot): Promise<void> | void;
  load(runId: string): Promise<RunSnapshot | null> | RunSnapshot | null;
}
