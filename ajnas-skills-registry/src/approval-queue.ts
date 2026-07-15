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
    request.status = resolution.approved ? "approved" : "rejected";
    request.resolvedAt = this.clock().toISOString();
    request.resolution = sanitizeJson(resolution) as unknown as SkillApprovalResolution;
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

function cloneRequest(request: SkillApprovalRequest): SkillApprovalRequest {
  return sanitizeJson(request) as unknown as SkillApprovalRequest;
}
