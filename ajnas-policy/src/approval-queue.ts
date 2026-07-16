import { toJsonObject } from "./stable-json.js";
import type {
  PolicyApprovalQueueOptions,
  PolicyApprovalRequest,
  PolicyApprovalRequestInput,
  PolicyApprovalResolution
} from "./types.js";

export class PolicyApprovalQueue {
  private readonly clock: () => Date;
  private readonly requests: PolicyApprovalRequest[] = [];

  constructor(options: PolicyApprovalQueueOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  enqueue(input: PolicyApprovalRequestInput): PolicyApprovalRequest {
    const request: PolicyApprovalRequest = {
      id: `policy_approval_${String(this.requests.length + 1).padStart(4, "0")}`,
      status: "pending",
      createdAt: this.clock().toISOString(),
      policyBundleId: input.policyBundleId,
      ...(input.ruleId === undefined ? {} : { ruleId: input.ruleId }),
      reason: input.reason,
      requestedBy: input.requestedBy,
      request: serializeRuntimeRequest(input.request),
      ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
    };
    const stored = cloneRequest(request);
    this.requests.push(stored);
    return cloneRequest(stored);
  }

  resolve(id: string, resolution: PolicyApprovalResolution): PolicyApprovalRequest {
    const request = this.requests.find((item) => item.id === id);
    if (!request) {
      throw new Error(`Policy approval request ${id} was not found`);
    }
    if (request.status !== "pending") {
      throw new Error(`Policy approval request ${id} is already ${request.status}`);
    }
    const checkedResolution = normalizeResolution(resolution);
    request.status = checkedResolution.approved ? "approved" : "rejected";
    request.resolvedAt = this.clock().toISOString();
    request.resolution = checkedResolution;
    return cloneRequest(request);
  }

  pending(): PolicyApprovalRequest[] {
    return this.requests.filter((request) => request.status === "pending").map(cloneRequest);
  }

  toJSON(): { schemaVersion: "ajnas.policy.approvals.v1"; requests: PolicyApprovalRequest[] } {
    return {
      schemaVersion: "ajnas.policy.approvals.v1",
      requests: this.requests.map(cloneRequest)
    };
  }
}

function normalizeResolution(resolution: unknown): PolicyApprovalResolution {
  if (resolution === null || typeof resolution !== "object" || Array.isArray(resolution)) throw new TypeError("Policy approval resolution must be a JSON object");
  const value = toJsonObject(resolution) as Record<string, unknown>;
  if (typeof value.approved !== "boolean") throw new TypeError("Policy approval approved must be a boolean");
  if (typeof value.approverId !== "string" || !value.approverId.trim()) throw new TypeError("Policy approval approverId must be a non-empty string");
  if (value.comment !== undefined && typeof value.comment !== "string") throw new TypeError("Policy approval comment must be a string");
  if (value.metadata !== undefined && (value.metadata === null || typeof value.metadata !== "object" || Array.isArray(value.metadata))) throw new TypeError("Policy approval metadata must be a JSON object");
  return value as unknown as PolicyApprovalResolution;
}

function cloneRequest(request: PolicyApprovalRequest): PolicyApprovalRequest {
  return toJsonObject(request) as unknown as PolicyApprovalRequest;
}

function serializeRuntimeRequest(request: PolicyApprovalRequestInput["request"]) {
  return {
    runId: request.runId,
    stepId: request.stepId,
    tool: {
      name: request.tool.name,
      description: request.tool.description ?? null,
      risk: request.tool.risk ?? null
    },
    input: toJsonObject(request.input),
    metadata: toJsonObject(request.metadata)
  };
}
