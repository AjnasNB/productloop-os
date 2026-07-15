import type {
  ApprovalGateRequest,
  BrowserResearchPlan,
  BrowserResearchPolicy,
  BrowserResearchPolicyDecision,
  BrowserResearchStep,
  PolicyEffect
} from "./types.js";
import { sha256Digest } from "./stable-json.js";

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function originMatches(origin: string | undefined, candidates: string[] | undefined): boolean {
  if (!origin || !candidates || candidates.length === 0) {
    return false;
  }
  return candidates.some((candidate) => {
    if (candidate === "*") {
      return true;
    }
    const normalized = normalizeOrigin(candidate) ?? candidate;
    return normalized === origin;
  });
}

export function evaluateBrowserResearchPolicy(
  plan: BrowserResearchPlan,
  step: BrowserResearchStep,
  options: { stepIndex?: number; policy?: BrowserResearchPolicy } = {}
): BrowserResearchPolicyDecision {
  const policy = options.policy ?? plan.policy ?? {};
  const reasons: string[] = [];
  let effect: PolicyEffect = "allow";
  const origin = normalizeOrigin(step.url);

  if (policy.maxSteps !== undefined && options.stepIndex !== undefined && options.stepIndex >= policy.maxSteps) {
    effect = "deny";
    reasons.push(`step index ${options.stepIndex} exceeds maxSteps ${policy.maxSteps}`);
  }

  if (policy.allowedActions?.length && !policy.allowedActions.includes(step.action)) {
    effect = "deny";
    reasons.push(`action ${step.action} is not in allowedActions`);
  }

  if (originMatches(origin, policy.blockedOrigins)) {
    effect = "deny";
    reasons.push(`origin ${origin} is blocked`);
  }

  if (origin && policy.allowedOrigins?.length && !originMatches(origin, policy.allowedOrigins)) {
    effect = "deny";
    reasons.push(`origin ${origin} is not in allowedOrigins`);
  }

  if (effect !== "deny") {
    if (step.requiresApproval || policy.requireApprovalForActions?.includes(step.action)) {
      effect = "require_approval";
      reasons.push(`action ${step.action} requires approval`);
    }
  }

  if (reasons.length === 0) {
    reasons.push("policy allowed browser research step");
  }

  return {
    effect,
    reasons,
    action: step.action,
    ...(origin === undefined ? {} : { origin }),
    stepId: step.id,
    policyDigest: sha256Digest(policy)
  };
}

export function createApprovalGateRequest(input: {
  runId: string;
  plan: BrowserResearchPlan;
  step: BrowserResearchStep;
  decision: BrowserResearchPolicyDecision;
  inputDigest: string;
  createdAt: string;
}): ApprovalGateRequest {
  const id = `approval_${sha256Digest({
    kind: "ajnas.browser.research.approval",
    runId: input.runId,
    planId: input.plan.id,
    stepId: input.step.id,
    inputDigest: input.inputDigest,
    policyDigest: input.decision.policyDigest
  }).slice("sha256:".length, "sha256:".length + 24)}`;

  return {
    schema: "ajnas.browser.research.approval-request.v1",
    id,
    runId: input.runId,
    planId: input.plan.id,
    stepId: input.step.id,
    action: input.step.action,
    reason: input.decision.reasons.join("; "),
    inputDigest: input.inputDigest,
    policyDigest: input.decision.policyDigest,
    createdAt: input.createdAt,
    status: "pending"
  };
}
