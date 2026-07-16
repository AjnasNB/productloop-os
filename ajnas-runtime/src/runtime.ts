import {
  ApprovalBindingError,
  ApprovalRejectedError,
  ApprovalRequiredError,
  InvalidRunIdError,
  InvalidPolicyDecisionError,
  PolicyDeniedError,
  RunIdCollisionError
} from "./errors.js";
import { createReceipt, toJsonObject } from "./provenance.js";
import { createRunId, digestJson, normalizeJson } from "./stable-json.js";
import { ToolRegistry } from "./tool-registry.js";
import type {
  ApprovalResponse,
  Approver,
  JsonObject,
  PolicyDecision,
  PolicyEngine,
  ProvenanceSink,
  RunSnapshot,
  RunStore,
  RuntimeEvent,
  RuntimeEventType,
  ToolCallMetadata,
  ToolDefinition,
  WorkflowContext,
  WorkflowDefinition
} from "./types.js";

export interface AgentRuntimeOptions {
  tools?: ToolRegistry | ToolDefinition[];
  policy?: PolicyEngine;
  approver?: Approver;
  provenance?: ProvenanceSink;
  store?: RunStore;
  clock?: () => Date;
  runIdFactory?: () => string;
}

export class AgentRuntime {
  private readonly tools: ToolRegistry;
  private readonly policy: PolicyEngine;
  private readonly approver?: Approver;
  private readonly provenance?: ProvenanceSink;
  private readonly store?: RunStore;
  private readonly clock: () => Date;
  private readonly runIdFactory: () => string;
  private readonly issuedRunIds = new Set<string>();

  constructor(options: AgentRuntimeOptions = {}) {
    this.tools = Array.isArray(options.tools)
      ? ToolRegistry.from(options.tools)
      : options.tools ?? new ToolRegistry();
    this.policy = options.policy ?? {
      evaluate: async () => ({
        decision: "deny",
        reason: "no policy engine was configured; runtime defaults deny tool calls"
      })
    };
    this.approver = options.approver;
    this.provenance = options.provenance;
    this.store = options.store;
    this.clock = options.clock ?? (() => new Date());
    this.runIdFactory = options.runIdFactory ?? createRunId;
  }

  async run<TInput = unknown>(workflow: WorkflowDefinition<TInput>): Promise<RunSnapshot> {
    const runId = this.runIdFactory();
    if (!isValidRunId(runId)) {
      throw new InvalidRunIdError();
    }
    if (this.issuedRunIds.has(runId)) {
      throw new RunIdCollisionError(runId);
    }
    this.issuedRunIds.add(runId);
    return this.runWithId(workflow, runId);
  }

  private async runWithId<TInput>(workflow: WorkflowDefinition<TInput>, runId: string): Promise<RunSnapshot> {
    const input = normalizeJson(workflow.input ?? {}) as unknown as TInput;
    const snapshot: RunSnapshot = {
      runId,
      name: workflow.name,
      status: "running",
      input,
      outputs: {},
      startedAt: this.now(),
      events: []
    };
    let previousHash: string | null = null;

    const emit = async (type: RuntimeEventType, data: JsonObject = {}): Promise<RuntimeEvent> => {
      const eventWithoutReceipt: Omit<RuntimeEvent, "receipt"> = {
        runId,
        sequence: snapshot.events.length + 1,
        type,
        timestamp: this.now(),
        data: normalizeJson(data) as JsonObject
      };
      const receipt = createReceipt(eventWithoutReceipt, previousHash);
      const event: RuntimeEvent = {
        ...eventWithoutReceipt,
        receipt
      };
      previousHash = receipt.eventHash;
      snapshot.events.push(cloneRuntimeEvent(event));
      await this.provenance?.record(cloneRuntimeEvent(event));
      await this.persist(snapshot);
      return cloneRuntimeEvent(event);
    };

    await emit("run.started", { name: workflow.name });

    try {
      for (const step of workflow.steps) {
        await emit("step.started", { stepId: step.id, description: step.description ?? null });
        const context: WorkflowContext<TInput> = {
          runId,
          stepId: step.id,
          input: normalizeJson(input) as unknown as TInput,
          outputs: normalizeJson(snapshot.outputs) as Record<string, unknown>,
          emit,
          callTool: async <TToolInput = unknown, TToolOutput = unknown>(
            toolName: string,
            toolInput: TToolInput,
            metadata: ToolCallMetadata = {}
          ): Promise<TToolOutput> =>
            this.callTool<TToolInput, TToolOutput>({
              runId,
              stepId: step.id,
              toolName,
              input: toolInput,
              metadata,
              emit
            })
        };

        try {
          snapshot.outputs[step.id] = normalizeJson(await step.run(context));
          await this.persist(snapshot);
          await emit("step.completed", { stepId: step.id, output: toJsonObject(snapshot.outputs[step.id]) });
        } catch (error) {
          await emit("step.failed", { stepId: step.id, error: errorToJson(error) });
          throw error;
        }
      }

      snapshot.status = "completed";
      snapshot.completedAt = this.now();
      await emit("run.completed", { outputs: toJsonObject(snapshot.outputs) });
      await this.persist(snapshot);
      return cloneSnapshot(snapshot);
    } catch (error) {
      snapshot.status = "failed";
      snapshot.failedAt = this.now();
      const errorCode = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
      snapshot.error = {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        ...(errorCode === undefined ? {} : { code: errorCode })
      };
      await emit("run.failed", { error: errorToJson(error) });
      await this.persist(snapshot);
      throw error;
    }
  }

  private async callTool<TToolInput, TToolOutput>(request: {
    runId: string;
    stepId: string;
    toolName: string;
    input: TToolInput;
    metadata: ToolCallMetadata;
    emit(type: RuntimeEventType, data?: JsonObject): Promise<RuntimeEvent>;
  }): Promise<TToolOutput> {
    const tool = this.tools.get(request.toolName);
    const risk = maxRisk(tool.risk, request.metadata.risk);
    const input = normalizeJson(request.input);
    const metadata = normalizeJson({
      ...request.metadata,
      risk
    }) as ToolCallMetadata;
    await request.emit("tool.requested", {
      stepId: request.stepId,
      toolName: tool.name,
      risk,
      input: toJsonObject(input),
      metadata: toJsonObject(metadata)
    });

    const rawDecision = await this.policy.evaluate({
      runId: request.runId,
      stepId: request.stepId,
      tool: Object.freeze({
        name: tool.name,
        description: tool.description,
        risk
      }),
      input: normalizeJson(input),
      metadata: normalizeJson(metadata) as ToolCallMetadata
    });
    const decision = normalizePolicyDecision(rawDecision, tool.name);
    await request.emit("policy.evaluated", policyEventData(tool.name, decision));

    if (decision.decision === "deny") {
      await request.emit("policy.denied", {
        stepId: request.stepId,
        toolName: tool.name,
        reason: decision.reason,
        metadata: decision.metadata ?? {}
      });
      throw new PolicyDeniedError(tool.name, decision.reason);
    }

    const approval = await this.resolveApproval({ ...request, input, metadata }, tool, decision, risk);

    try {
      const output = normalizeJson(await tool.execute({
        runId: request.runId,
        stepId: request.stepId,
        toolName: tool.name,
        input: normalizeJson(input),
        metadata: normalizeJson(metadata) as ToolCallMetadata,
        approval: approval ? (normalizeJson(approval) as unknown as ApprovalResponse) : undefined
      })) as unknown as TToolOutput;
      await request.emit("tool.completed", {
        stepId: request.stepId,
        toolName: tool.name,
        output: toJsonObject(output)
      });
      return normalizeJson(output) as unknown as TToolOutput;
    } catch (error) {
      await request.emit("tool.failed", {
        stepId: request.stepId,
        toolName: tool.name,
        error: errorToJson(error)
      });
      throw error;
    }
  }

  private async resolveApproval(
    request: {
      runId: string;
      stepId: string;
      toolName: string;
      input: unknown;
      metadata: ToolCallMetadata;
      emit(type: RuntimeEventType, data?: JsonObject): Promise<RuntimeEvent>;
    },
    tool: ToolDefinition,
    decision: PolicyDecision,
    risk: string
  ): Promise<ApprovalResponse | undefined> {
    if (decision.decision !== "require_approval") {
      return undefined;
    }

    await request.emit("approval.requested", {
      stepId: request.stepId,
      toolName: tool.name,
      risk,
      reason: decision.reason,
      prompt: decision.approvalPrompt ?? null,
      input: toJsonObject(request.input)
    });

    if (!this.approver) {
      throw new ApprovalRequiredError(tool.name, decision.reason);
    }

    const bindingDigest = digestJson({
      runId: request.runId,
      stepId: request.stepId,
      toolName: tool.name,
      risk,
      input: request.input,
      metadata: request.metadata,
      reason: decision.reason,
      prompt: decision.approvalPrompt ?? null
    });
    const rawResponse = await this.approver.requestApproval({
      runId: request.runId,
      stepId: request.stepId,
      toolName: tool.name,
      risk: risk as ToolDefinition["risk"],
      input: normalizeJson(request.input),
      reason: decision.reason,
      ...(decision.approvalPrompt === undefined ? {} : { prompt: decision.approvalPrompt }),
      metadata: normalizeJson(request.metadata) as ToolCallMetadata,
      bindingDigest
    });

    const response = normalizeApprovalResponse(rawResponse, tool.name, bindingDigest);
    const boundResponse: ApprovalResponse = {
      approved: response.approved,
      approverId: response.approverId,
      bindingDigest,
      ...(response.comment === undefined ? {} : { comment: response.comment }),
      ...(response.metadata === undefined ? {} : { metadata: toJsonObject(response.metadata) })
    };

    await request.emit("approval.resolved", {
      stepId: request.stepId,
      toolName: tool.name,
      approved: boundResponse.approved,
      approverId: boundResponse.approverId,
      comment: boundResponse.comment ?? null,
      metadata: boundResponse.metadata ?? {},
      bindingDigest
    });

    if (!boundResponse.approved) {
      throw new ApprovalRejectedError(tool.name, boundResponse.approverId, boundResponse.comment);
    }
    return boundResponse;
  }

  private async persist(snapshot: RunSnapshot): Promise<void> {
    await this.store?.save(cloneSnapshot(snapshot));
  }

  private now(): string {
    return this.clock().toISOString();
  }
}

function normalizePolicyDecision(value: unknown, toolName: string): PolicyDecision {
  try {
    const normalized = normalizeJson(value);
    if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new TypeError("decision must be a JSON object");
    }
    const record = normalized as JsonObject;
    if (record.decision !== "allow" && record.decision !== "deny" && record.decision !== "require_approval") {
      throw new TypeError("decision must be allow, deny, or require_approval");
    }
    if (typeof record.reason !== "string" || !record.reason.trim()) {
      throw new TypeError("reason must be a non-empty string");
    }
    if (record.metadata !== undefined && (record.metadata === null || typeof record.metadata !== "object" || Array.isArray(record.metadata))) {
      throw new TypeError("metadata must be a JSON object");
    }
    if (record.approvalPrompt !== undefined) {
      if (record.decision !== "require_approval" || typeof record.approvalPrompt !== "string" || !record.approvalPrompt.trim()) {
        throw new TypeError("approvalPrompt must be a non-empty string on require_approval decisions");
      }
    }
    const allowed = new Set(record.decision === "require_approval"
      ? ["decision", "reason", "approvalPrompt", "metadata"]
      : ["decision", "reason", "metadata"]);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
      throw new TypeError("decision contains unsupported fields");
    }
    return normalized as unknown as PolicyDecision;
  } catch (error) {
    if (error instanceof InvalidPolicyDecisionError) throw error;
    throw new InvalidPolicyDecisionError(toolName, error instanceof Error ? error.message : String(error));
  }
}

function normalizeApprovalResponse(value: unknown, toolName: string, bindingDigest: string): ApprovalResponse {
  try {
    const normalized = normalizeJson(value);
    if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new TypeError("approval response must be a JSON object");
    }
    const response = normalized as JsonObject;
    if (response.bindingDigest !== bindingDigest) throw new TypeError("binding digest does not match");
    if (typeof response.approved !== "boolean") throw new TypeError("approved must be a boolean");
    if (typeof response.approverId !== "string" || !response.approverId.trim()) {
      throw new TypeError("approverId must be a non-empty string");
    }
    if (response.comment !== undefined && typeof response.comment !== "string") {
      throw new TypeError("comment must be a string");
    }
    if (response.metadata !== undefined && (response.metadata === null || typeof response.metadata !== "object" || Array.isArray(response.metadata))) {
      throw new TypeError("metadata must be a JSON object");
    }
    const allowed = new Set(["approved", "approverId", "bindingDigest", "comment", "metadata"]);
    if (Object.keys(response).some((key) => !allowed.has(key))) throw new TypeError("approval response contains unsupported fields");
    return normalized as unknown as ApprovalResponse;
  } catch {
    throw new ApprovalBindingError(toolName);
  }
}

function maxRisk(declared: ToolDefinition["risk"], requested: ToolCallMetadata["risk"]): ToolDefinition["risk"] {
  const order = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  if (requested === undefined) return declared;
  return order[requested] > order[declared] ? requested : declared;
}

function isValidRunId(runId: string): boolean {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(runId)) return false;
  return !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(runId);
}

function cloneRuntimeEvent(event: RuntimeEvent): RuntimeEvent {
  return normalizeJson(event) as unknown as RuntimeEvent;
}

function cloneSnapshot(snapshot: RunSnapshot): RunSnapshot {
  return normalizeJson(snapshot) as unknown as RunSnapshot;
}

function policyEventData(toolName: string, decision: PolicyDecision): JsonObject {
  return {
    toolName,
    decision: decision.decision,
    reason: decision.reason,
    metadata: decision.metadata ?? {},
    approvalPrompt: decision.decision === "require_approval" ? decision.approvalPrompt ?? null : null
  };
}

function errorToJson(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? String((error as { code: unknown }).code) : null
    };
  }
  return { name: "Error", message: String(error), code: null };
}
