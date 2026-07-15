import { sha256Hex, stableJson, toJsonObject } from "./stable-json.js";
import { computeConnectorDigest } from "./validation.js";
import type {
  ConnectorApprovalQueueOptions,
  ConnectorApprovalRequest,
  ConnectorApprovalRequestInput,
  ConnectorApprovalResolution
} from "./types.js";

export class ConnectorApprovalQueue {
  private readonly requests = new Map<string, ConnectorApprovalRequest>();
  private readonly clock: () => Date;

  constructor(options: ConnectorApprovalQueueOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  request(input: ConnectorApprovalRequestInput): ConnectorApprovalRequest {
    const createdAt = this.clock().toISOString();
    const sequence = this.requests.size + 1;
    const requestSeed = stableJson({
      sequence,
      createdAt,
      connectorId: input.manifest.id,
      connectorVersion: input.manifest.version,
      requestedBy: input.requestedBy,
      reason: input.reason,
      invocation: input.invocation ?? null
    });
    const id = `connector-approval-${sequence}-${sha256Hex(requestSeed).slice(0, 12)}`;
    const request: ConnectorApprovalRequest = {
      id,
      status: "pending",
      createdAt,
      connectorId: input.manifest.id,
      connectorVersion: input.manifest.version,
      manifestDigest: computeConnectorDigest(input.manifest),
      reason: input.reason,
      requestedBy: input.requestedBy,
      ...(input.invocation === undefined ? {} : { invocation: toJsonObject(input.invocation) }),
      ...(input.trustEvaluation === undefined ? {} : { trustEvaluation: toJsonObject(input.trustEvaluation) }),
      ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
    };
    const stored = cloneRequest(request);
    this.requests.set(id, stored);
    return cloneRequest(stored);
  }

  resolve(id: string, resolution: ConnectorApprovalResolution): ConnectorApprovalRequest {
    const existing = this.requests.get(id);
    if (!existing) {
      throw new Error(`Approval request ${id} was not found.`);
    }
    if (existing.status !== "pending") {
      throw new Error(`Approval request ${id} is already ${existing.status}.`);
    }
    const resolved: ConnectorApprovalRequest = {
      ...existing,
      status: resolution.approved ? "approved" : "rejected",
      resolvedAt: this.clock().toISOString(),
      resolution: toJsonObject(resolution) as unknown as ConnectorApprovalResolution
    };
    this.requests.set(id, cloneRequest(resolved));
    return cloneRequest(resolved);
  }

  get(id: string): ConnectorApprovalRequest | undefined {
    const request = this.requests.get(id);
    return request ? cloneRequest(request) : undefined;
  }

  list(status?: ConnectorApprovalRequest["status"]): ConnectorApprovalRequest[] {
    const requests = [...this.requests.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return (status ? requests.filter((request) => request.status === status) : requests).map(cloneRequest);
  }
}

function cloneRequest(request: ConnectorApprovalRequest): ConnectorApprovalRequest {
  return toJsonObject(request) as unknown as ConnectorApprovalRequest;
}
