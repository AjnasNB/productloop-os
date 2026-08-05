import type { JsonObject, WorkbenchApproval, WorkbenchProofBundle, WorkbenchSnapshot } from "./types.js";

/**
 * Host-supplied boundary for a separately reviewed team control plane.
 * ProductLoop Workbench ships this contract but no hosted implementation.
 */
export interface TeamControlPlaneAdapter {
  readonly id: string;
  readonly capabilities: readonly TeamControlPlaneCapability[];
  publishApprovalRequest(approval: WorkbenchApproval): Promise<{ remoteId: string }>;
  synchronizeSnapshot(snapshot: WorkbenchSnapshot): Promise<{ checkpoint: string }>;
  exportAuditBundle(bundle: WorkbenchProofBundle): Promise<{ receipt: string }>;
  health(): Promise<{ ready: boolean; details?: JsonObject }>;
}

export type TeamControlPlaneCapability =
  | "team-sync"
  | "reviewer-directory"
  | "sso-rbac"
  | "managed-workers"
  | "audit-retention"
  | "billing-entitlements";

export const PRIVATE_CONTROL_PLANE_BOUNDARY = Object.freeze({
  implementationIncluded: false,
  localCommunityFeatures: ["durable-runs", "exact-approvals", "evidence", "memory-links", "policy-inspection", "proof-export"],
  separatelyOperatedFeatures: ["team-sync", "sso-rbac", "managed-workers", "central-approvals", "billing", "multi-tenant-retention"]
});
