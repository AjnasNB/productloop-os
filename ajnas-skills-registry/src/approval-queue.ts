import { UnknownApprovalRequestError } from "./errors.js";
import { sanitizeJson, sha256, stableStringify } from "./stable-json.js";
import type { EnqueueSkillApprovalInput, SkillApprovalQueueOptions, SkillApprovalRequest, SkillApprovalResolution } from "./types.js";

export class SkillApprovalQueue {
  private readonly requests: SkillApprovalRequest[] = [];
  private readonly clock: () => Date;

  constructor(options: SkillApprovalQueueOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  enqueue(input: EnqueueSkillApprovalInput): SkillApprovalRequest {
    const requestedAt = this.clock().toISOString();
    const request: SkillApprovalRequest = {
      ...input,
      id: `skill_review_${sha256(stableStringify({ ...input, requestedAt })).slice(0, 16)}`,
      status: "pending",
      requestedAt
    };
    const stored = cloneRequest(request);
    this.requests.push(stored);
    return cloneRequest(stored);
  }

  resolve(id: string, resolution: SkillApprovalResolution): SkillApprovalRequest {
    const request = this.requests.find((entry) => entry.id === id);
    if (!request) {
      throw new UnknownApprovalRequestError(id);
    }
    if (request.status !== "pending") {
      throw new Error(`Skill approval request ${id} is already ${request.status}.`);
    }
    const checkedResolution = normalizeResolution(resolution);
    request.status = checkedResolution.approved ? "approved" : "rejected";
    request.resolvedAt = this.clock().toISOString();
    request.resolution = checkedResolution;
    return cloneRequest(request);
  }

  pending(): SkillApprovalRequest[] {
    return this.requests.filter((request) => request.status === "pending").map(cloneRequest);
  }

  toJSON(): { requests: SkillApprovalRequest[] } {
    return {
      requests: this.requests.map(cloneRequest)
    };
  }
}

function normalizeResolution(resolution: unknown): SkillApprovalResolution {
  if (resolution === null || typeof resolution !== "object" || Array.isArray(resolution)) throw new TypeError("Skill approval resolution must be a JSON object.");
  const normalized = sanitizeJson(resolution);
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) throw new TypeError("Skill approval resolution must be a JSON object.");
  const value = normalized as Record<string, unknown>;
  if (typeof value.approved !== "boolean") throw new TypeError("Skill approval approved must be a boolean.");
  if (typeof value.approverId !== "string" || !value.approverId.trim()) throw new TypeError("Skill approval approverId must be a non-empty string.");
  if (value.comment !== undefined && typeof value.comment !== "string") throw new TypeError("Skill approval comment must be a string.");
  if (value.metadata !== undefined && (value.metadata === null || typeof value.metadata !== "object" || Array.isArray(value.metadata))) throw new TypeError("Skill approval metadata must be a JSON object.");
  return value as unknown as SkillApprovalResolution;
}

function cloneRequest(request: SkillApprovalRequest): SkillApprovalRequest {
  return sanitizeJson(request) as unknown as SkillApprovalRequest;
}
